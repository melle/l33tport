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

// we need the Stanford Javascript Crypto Library, see https://github.com/bitwiseshiftleft/sjcl
var sjcl = require("./sjcl.js");
var querystring = require('querystring');
var http = require('http');

// used during the login procedure
var challengev = "";
var sessionID = "";

/**
 * Requests the password-challenge from the router. Calls handleChallenge() on success.
 */
function getChallenge() {
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
          handleChallenge(challengev);          
      });
  });

  req.write(data);
  req.end();
}

/** 
 * Hashes challenge + password and sent it back to speedport. 
 */
function handleChallenge(challenge) {
  var encryptpwd = sjcl.hash.sha256.hash(challenge + ":" + PASSWORD);
  var passwordhash = sjcl.codec.hex.fromBits(encryptpwd);

  sendPassword(passwordhash);
}

/** 
 * Sends the hashed password to the router and acquires a session ID.
 */
function sendPassword(passwordHash) {
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

          // poor mans str(), cookie needs to be a string
          var cookie = "" + res.headers['set-cookie'];
          var sid = cookie.match(/^.*(SessionID_R3=[a-zA-Z0-9]*).*/);
          sessionID = sid[1];

          performRequests();
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
 *
 */
function performRequests()
{
  var args = process.argv.slice(2);
  args.forEach(function(entry) {
    downloadJsonInfo(entry);
  });
}

/** Downloads the give json file and prints to stdout. */
function downloadJsonInfo(fileName)
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

    res.on('data', function (chunk) {
      console.log("" + chunk);
    }).on('error', function(e) {
      console.log("Got error: ", e);
    });
  });
}

if (2 == process.argv.length) {
  console.log(" l33tport - downloads JSON status data from Telekom Speedport Hybrid");
  console.log("");
  console.log(" One ore more of the folloing options may be:");
  console.log("");
  console.log(" dsl              DSL connection status and line information");
  console.log(" interfaces       Network interfaces");
  console.log(" arp              ARP table");
  console.log(" session          PPPoE Session");
  console.log(" dhcp_client      DHCP client");
  console.log(" dhcp_server      DHCP server, includes DHCP leases ");
  console.log(" ipv6             IPv6 Router Advertisement");
  console.log(" dns              DNS server and cache information");
  console.log(" routing          Routing table");
  console.log(" igmp_proxy       IGMP Proxy");
  console.log(" igmp_snooping    IGMP Snooping Table");
  console.log(" wlan             WLAN status and information");
  console.log(" module           Software version information");
  console.log(" memory           Memory and CPU utilization");
  console.log(" speed            Speed dial");
  console.log(" webdav           WebDAV URL");
  console.log(" bonding_client   Bonding HA client");
  console.log(" bonding_tunnel   Bonding tunnel");
  console.log(" filterlist       Filter list table");
  console.log(" bonding_tr181    Bonding TR-181");
  console.log(" lteinfo          LTE information");
  console.log(" Status           Systeminformation (no login needed)");
  console.log("");
  console.log(" Example: node ./l33tport.js dsl lteinfo");

  process.exit(1);
}

// start by requesting the challenge for the session
getChallenge();
