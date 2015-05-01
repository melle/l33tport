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
  .option('-f, --fieldname <fieldname>', 'specifies the status field');

program.on('--help', function(){
  console.log('  Currently supported status fields:');
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
  console.log('  Status           Systeminformation (no login needed)');
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
  console.log('    -u "uSNR,dSNR,uactual,dactual,uatainable,dattainable"');
  console.log('');
});

program.parse(process.argv);


/**
 * Requests the password-challenge from the router. Calls handleChallenge() on success.
 */
function getChallenge(fieldName, dataCallback) {
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
          handleChallenge(challengev, fieldName, dataCallback);          
      });
  });

  req.write(data);
  req.end();
}

/** 
 * Hashes challenge + password and sent it back to speedport. 
 */
function handleChallenge(challenge, fieldName, dataCallback) {
  var encryptpwd = sjcl.hash.sha256.hash(challenge + ":" + PASSWORD);
  var passwordhash = sjcl.codec.hex.fromBits(encryptpwd);

  sendPassword(passwordhash, fieldName, dataCallback);
}

/** 
 * Sends the hashed password to the router and acquires a session ID.
 */
function sendPassword(passwordHash, fieldName, dataCallback) {
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
          var statusJSON = chunk;

          // fix invalid json sent from the router (on successful login,
          // there is a comma after the last brace)
          if (chunk.lastIndexOf('}') < chunk.lastIndexOf(','))
          {
            // the "fix" is to append an empty entity
            statusJSON = chunk.replace(']','{}]');
          }
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

          downloadJsonInfo(fieldName, dataCallback);
      });
  });

  req.write(data);
  req.end();
}

/**
 * Downloads the given json, the following paths are known to be valid:
 * 
 * /data/dsl.json
 * /data/interfaces.json
 * /data/arp.json
 * /data/session.json
 * /data/dhcp_client.json
 * /data/dhcp_server.json
 * /data/ipv6.json
 * /data/dns.json
 * /data/routing.json
 * /data/igmp_proxy.json
 * /data/igmp_snooping.json
 * /data/wlan.json
 * /data/module.json
 * /data/memory.json
 * /data/speed.json
 * /data/webdav.json
 * /data/bonding_client.json
 * /data/bonding_tunnel.json
 * /data/filterlist.json
 * /data/bonding_tr181.json
 * /data/letinfo.json
 *
 * /data/Status.json (No login needed)
 */
function downloadJsonInfo(fieldName, dataCallback)
{
  var cookie = "challengev=" + challengev + "; " + sessionID;
  var requestPath = "/data/" + fieldName + ".json";

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

    res.on('data', function (chunk) {
      // fix invalid json ....
      dataCallback(chunk.toString().replace(/\'/g,'\"'));
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
 * the elemens in hte input array.
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
    return s.join(":");
}


// check parameters, was any parameter given?
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
else if (!program.output || !program.fieldname) {
  console.log('⚠️  Error: output format and field name must be specified.');
  program.outputHelp();
}
else if (program.output == 'rrd' && !program.dsNames) {
  console.log('⚠️  Error: rrdoutput requires dsNames parameter.');
  program.outputHelp();
}


// format parameter given?
if (program.output && program.output != 'rrd') {
  // simple json output
  getChallenge(program.fieldname, function(data) {
    var parsed = JSON.parse(data);
    console.log(parsed);
  });
} 
// RRDUPDATE parameter given?
else if (program.fieldname && program.dsNames) {
  getChallenge(program.fieldname, function(data) {
    var parsed = JSON.parse(data);

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
