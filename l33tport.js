#!/usr/bin/env node
/*
----------------------------------------------------------------------------
"THE BEER-WARE LICENSE" (Revision 42): <github@dysternis.de> wrote this
file. As long as you retain this notice you can do whatever you want with this
stuff. If we meet some day, and you think this stuff is worth it, you can buy
me a beer in return. Thomas Mellenthin. 
-----------------------------------------------------------------------------
*/

const SPEEDPORT = "192.168.2.1"; // the IP address or hostname of your speedport
const PASSWORD  = "66666666"; // the login-password of the speedport

// Requiremtens: commander, sjcl
//
// npm install commander
// npm install sjcl
//


// we need the Stanford Javascript Crypto Library, see https://github.com/bitwiseshiftleft/sjcl
var sjcl = require("sjcl");
var querystring = require('querystring');
var http = require('http');
var program = require('commander'); // command line parsing

// used during the login procedure
var challengev = "";
var sessionID = "";

// command line parsing
program
  .version('0.0.2')
  .description('Downloads JSON status data from Telekom Speedport Hybrid')
  .option('-o, --output <format>', 'Output format (json, rrd)', /^(json|rrd)$/i, 'json')
  .option('-d, --dsNames <dsNames>', 'rrdtool update format specifier')
  .option('-f, --filename <filename>', 'specifies the file to download');

program.on('--help', function(){
  console.log('  Here is a list of the known working file names:');
  console.log('');
  console.log('  dsl              DSL connection status and line information');
  console.log('  interfaces       Network interfaces');
  console.log('  arp              ARP table');
  console.log('  session          PPPoE Session');
  console.log('  dhcp_client      DHCP client');
  console.log('  dhcp_server      DHCP server, includes DHCP leases ');
  console.log('  ipv6             IPv6 Router Advertisement');
  console.log('  dns              DNS server and cache information');
  console.log('  routing          Routing table');
  console.log('  igmp_proxy       IGMP Proxy');
  console.log('  igmp_snooping    IGMP Snooping Table');
  console.log('  wlan             WLAN status and information');
  console.log('  module           Software version information');
  console.log('  memory           Memory and CPU utilization');
  console.log('  speed            Speed dial');
  console.log('  webdav           WebDAV URL');
  console.log('  bonding_client   Bonding HA client');
  console.log('  bonding_tunnel   Bonding tunnel');
  console.log('  filterlist       Filter list table');
  console.log('  bonding_tr181    Bonding TR-181');
  console.log('  lteinfo          LTE information');
  console.log('  Status           System information (no login needed)');
  console.log('  SecureStatus     Secure system information (login needed)');
  console.log('  Overview         General status information, i.e. tunnel status');
  console.log('  modules          ');
  console.log('  Abuse            trusted SMTP servers configuration');
  console.log('  DECTStation      DECT configuration');
  console.log('  hsdelmobil       DECT handset status');
  console.log('  LAN              LAN status (DHCP assigned IPs ect.)');
  console.log('');
  console.log('  Examples:');
  console.log('');
  console.log('  Download dsl status file and print content in JSON format:');
  console.log('');
  console.log('  $ node ./l33tport.js -f dsl');
  console.log('');
  console.log('  Download dsl status file and format output to fit as input for \'rddtool update\'');
  console.log('  command. Field names must be equal to names used in the JSON output:');
  console.log('');
  console.log('  $ node ./l33tport.js -f dsl -o rrd \\');
  console.log('    -d "uSNR,dSNR,uactual,dactual,uatainable,dattainable"');
  console.log('');
});

program.parse(process.argv);


/**
 * Requests the password-challenge from the router. Calls handleChallenge() on success.
 */
function getChallenge(filename, dataCallback) {
  var data = querystring.stringify({
        csrf_token: "nulltoken",
        showpw: "0",
        challengev: "null"
      });

  var options = {
      host: SPEEDPORT,
      path: '/data/Login.json',
      method: 'POST',
      headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(data)
      }
  };

  var req = http.request(options, function(res) {
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
          // challengev -> will be sent as cookie 
          challengev = JSON.parse(chunk)[1].varvalue;
          handleChallenge(challengev, filename, dataCallback);          
      });
  });

  req.write(data);
  req.end();
}

/** 
 * Hashes challenge + password and sent it back to speedport. 
 */
function handleChallenge(challenge, filename, dataCallback) {
  var encryptpwd = sjcl.hash.sha256.hash(challenge + ":" + PASSWORD);
  var passwordhash = sjcl.codec.hex.fromBits(encryptpwd);

  sendPassword(passwordhash, filename, dataCallback);
}

/** 
 * Sends the hashed password to the router and acquires a session ID.
 */
function sendPassword(passwordHash, filename, dataCallback) {
  var data = querystring.stringify({
      password: passwordHash,
      showpw: "0",
      csrf_token: "nulltoken"
    });

  var options = {
      host: SPEEDPORT,
      path: '/data/Login.json',
      method: 'POST',
      headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(data)
      }
  };

  var req = http.request(options, function(res) {
      res.setEncoding('utf8');
      res.on('data', function (chunk) {

          // chunk = status JSON response
          // The regex fixes invalid json sent from the router (on
          // successful login there is a comma after the last brace)
          var statusJSON = chunk.replace(/}\s*,\s*]/g, "}]");
          status = JSON.parse(statusJSON);

          // Result json uses "vartype" which is value, option or status.
          // Simply ignore this and put the other stuff into a new dict
          var statusDict = {};
          for (var v in status) {
            statusDict[status[v].varid] = status[v].varvalue
          }

          // are we happy?
          if (statusDict['login'] != 'success') {
            console.log("Login failed! ", statusDict);
            process.exit(1);
          }

          var cookie = res.headers['set-cookie'].toString();
          var sid = cookie.match(/^.*(SessionID_R3=[a-zA-Z0-9]*).*/);
          sessionID = sid[1];

          downloadJsonInfo(filename, dataCallback);
      });
  });

  req.write(data);
  req.end();
}

/**
 * Downloads the given json from  /data/$FILENAME.json. See help for a list 
 * of known and valid file names.
 */
function downloadJsonInfo(fileName, dataCallback)
{
  var cookie = "challengev=" + challengev + "; " + sessionID;
  var requestPath = "/data/" + fileName + ".json";

  var options = {
      host: SPEEDPORT,
      path: requestPath,
      method: 'GET',
      headers: {
          'Cookie': cookie
      }
  };

  http.get(options, function(res) {
    if (200 != res.statusCode) {
      console.log("WTF: ", res.statusCode);
    }

    var body = '';
    res.on('data', function (chunk) {
        body += chunk;
    }).on('end', function() {
        // got everything, now fix the invalid json ....
        var fixedQuotes = body.replace(/\'/g,'\"');
        // fix  },]  in arrays...
        var fixedArrays = fixedQuotes.replace(/\},\s+? +?\]/,"}\n    ]");
        dataCallback(fixedArrays);
    }).on('error', function(e) {
      console.log("Got error: ", e);
    });
  });
}

/**
 * Walks the multidimensional array given and returns the values 
 * of the given keys.
 *
 * At the moment the order of the keys must be the same order of 
 * the elemens in the input array.
 *
 * Solution from http://stackoverflow.com/a/10666489/699208
 */
function walkArray(inArray, dsNames) {
    var s = [];
    for(var k in inArray) {
      if(typeof inArray[k] == 'object') {
        s.push(walkArray(inArray[k], dsNames) );
      }
      else {
        for (var dsName in dsNames) {
          if (k == dsNames[dsName]) {
            s.push(inArray[k]);
          }
        }
      }
    }
    
    // For unknown reasons, the result is prefixed with a colon
    // sometimes. I guess the array contains bogus content then.
    return s.join(":").replace(/^:/, '');
}

/**
 * calls JSON.parse() and catches exceptions.
 */
function safeParse(input) {
    var parsed = null;
    try{
      parsed = JSON.parse(input.replace(/}\s*,\s*]/g, "}]"));
    }
    catch (e) {
      console.error("Could not parse JSON:");
      console.error(input);

      var exmsg = "";
      if (e.message) {
          exmsg += e.message;
      }
      if (e.stack) {
          exmsg += '\n' + e.stack;
      }
      console.error(exmsg);
    }

    return parsed;
}

// check parameters, was any parameter given?
if (!process.argv.slice(2).length) {
  program.outputHelp();
  process.exit();
}
else if (!program.output || !program.filename) {
  console.log('⚠️  Error: output format and field name must be specified.');
  program.outputHelp();
  process.exit();
}
else if (program.output == 'rrd' && !program.dsNames) {
  console.log('⚠️  Error: rrdoutput requires dsNames parameter.');
  program.outputHelp();
  process.exit();
}


// format parameter given?
if (program.output && program.output != 'rrd') {
  // simple json output
  getChallenge(program.filename, function(data) {
    var parsed = safeParse(data);
    console.log(parsed);
  });
} 
// RRDUPDATE parameter given?
else if (program.filename && program.dsNames) {
  getChallenge(program.filename, function(data) {
    var parsed = safeParse(data);

    // split fields
    dsNames = program.dsNames.split(',');
    var rrdUpdate = '--template ';
    for (var dsName in dsNames) {
      rrdUpdate += dsNames[dsName];
      rrdUpdate += ':';
    }
    // truncate last colon
    rrdUpdate = rrdUpdate.slice(0,-1);

    // prepare values section
    rrdUpdate += ' N:';

    // walk the values array
    rrdUpdate += walkArray(parsed, dsNames);

    console.log(rrdUpdate);
  });
};
