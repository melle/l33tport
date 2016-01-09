
l33tport
======

#### Downloads JSON status data from Telekom Speedport Hybrid

You own a Telekom Speedport Router? The web-interface sucks? It forces you to login every fucking time? You want to draw fancy rrdtool-graphs from raw data?

This script helps you to access the status information that is available in the "hidden" [Engineer-Menu](http://speedport.ip/engineer/html/dsl.html?lang=en), which is only available after you perform a login on the bloated web interface.

![The engineer menu of the Telekom Speedport Hybrid.](assets/EngineerMenu.jpg)

Prerequisites
==========
l33tport was written using node.js, so you need to have a working node installation. For the crypto-foo we're are using the [Stanford Javascript Crypto Library](https://github.com/bitwiseshiftleft/sjclsjcl.js), for commandline parsing commander is needed:

```
npm install sjcl
npm install commander
```

Usage
=====

Adjust the address (Usually ```speedport.ip``` / ```192.168.2.1```) and the password in the header of the script.

Usage: speedport [options]

Options:

    -h, --help                   output usage information
    -V, --version                output the version number
    -o, --output <format>        Output format (json, rrd)
    -d, --dsNames <dsNames>      rrdtool update format specifier
    -f, --fieldname <fieldname>  specifies the status field


You may use one of the following fieldnames (i.e. -f dsl):

* **dsl**              DSL connection status and line information
* **interfaces**       Network interfaces
* **arp**              ARP table
* **session**          PPPoE Session
* **dhcp_client**      DHCP client
* **dhcp_server**      DHCP server, includes DHCP leases 
* **ipv6**             IPv6 Router Advertisement
* **dns**              DNS server and cache information
* **routing**          Routing table
* **igmp_proxy**       IGMP Proxy
* **igmp_snooping**    IGMP Snooping Table
* **wlan**             WLAN status and information
* **module**           Software version information
* **memory**           Memory and CPU utilization
* **speed**            Speed dial
* **webdav**           WebDAV URL
* **bonding_client**   Bonding HA client
* **bonding_tunnel**   Bonding tunnel
* **filterlist**       Filter list table
* **bonding_tr181**    Bonding TR-181
* **lteinfo**          LTE information
* **Status**           Systeminformation (no login needed)
* **SecureStatus**     Secure system information (login needed)
* **Overview**         General status information, i.e. tunnel status
* **modules**
* **Abuse**            trusted SMTP servers configuration
* **DECTStation**      DECT configuration
* **hsdelmobil**       DECT handset status
* **LAN**              LAN status (DHCP assigned IPs ect.)


Examples
========

Download dsl status file and print content in JSON format:

    $ node ./l33tport.js -f dsl

The result will look like this:

```
{ Connection: 
   { dsl_operaing_mode: 'ADSL_2plus',
     path_mode: 'None',
     state: 'Up',
     training_results: 'Showtime',
     mode_lo: 'L0',
     vpi_vci: '1/32' },
  Line: 
   { uactual: '1167',
     dactual: '13551',
     uattainable: '1368',
     dattainable: '13524',
     uSNR: '109',
     dSNR: '59',
     uSignal: '130',
     dSignal: '0',
     uLine: '210',
     dLine: '420',
     uBIN: '512',
     dBIN: '512',
     uFEC_size: '1',
     dFEC_size: '1',
     uCodeword: '0',
     dCodeword: '0',
     uInterleave: '0',
     dInterleave: '0',
     uCRC: '4',
     dCRC: '6901',
     uHEC: '2',
     dHEC: '30865',
     uFEC: '0',
     dFEC: '0' } }
```

rrdtool integration
=============

![A DSL line with lots of errors.](assets/dsl-48h.png)

l33tport 's output may be formatted to fit as input for 'rddtool update' command. The rrdtool data source names must be equal to names used in the JSON. Example for updating the dsl-Databae:

    $ ./l33tport.js -f dsl -o rrd -d "uSNR,dSNR,uactual,dactual,uatainable,dattainable"

The output looks like this:

    --template uSNR:dSNR:uactual:dactual:uatainable:dattainable N:1167:13551:13468:109:59
   
It may be fed directly into a ```rrdtool update``` call:

    rrdtool update dsl.rrd $(./l33tport.js -f dsl -o rrd -d "uSNR,dSNR,uactual,dactual,uatainable,dattainable")

See the ```rrdtool``` directory for sample scripts.
