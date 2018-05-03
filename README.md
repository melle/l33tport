
l33tport
======

#### Downloads JSON status data from Telekom Speedport Hybrid

You own a Telekom Speedport Router? The web-interface sucks? It forces you to login every fucking time? You want to draw fancy rrdtool-graphs from raw data?

This script helps you to access the status information that is available in the "hidden" [Engineer-Menu](http://speedport.ip/engineer/html/dsl.html?lang=en), which is only available after you perform a login on the bloated web interface.

![The engineer menu of the Telekom Speedport Hybrid.](assets/EngineerMenu.jpg)

Login Problems
==============

Speedport firmware >= `050124.03.05*` changed the login procedure. In case you are using an older firmware, please use the branch [`old-login`](https://github.com/melle/l33tport/tree/old-login).
Current master branch supports newer firmware versions.


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

    -h, --help                 output usage information
    -V, --version              output the version number
    -o, --output <format>      Output format (json, rrd, influx)
    -d, --dsNames <dsNames>    rrdtool update format specifier. Mandatory when '-o rrd' is used
    -k, --keys <keys>          key names for influx output. Mandatory when '-o influx' is used
    -f, --filename <filename>  specifies the file to download


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

The firmware provides more fields, but the contents is not plaintext json. Contributions to make these fields available as plain text are appreciated 😬

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
===================

![A DSL line with lots of errors.](assets/dsl-48h.png)

l33tport 's output may be formatted to fit as input for 'rddtool update' command. The rrdtool data source names must be equal to names used in the JSON. Example for updating the dsl-Databae:

    $ ./l33tport.js -f dsl -o rrd -d "uSNR,dSNR,uactual,dactual,uatainable,dattainable"

The output looks like this:

    --template uSNR:dSNR:uactual:dactual:uatainable:dattainable N:1167:13551:13468:109:59
   
It may be fed directly into a ```rrdtool update``` call:

    rrdtool update dsl.rrd $(./l33tport.js -f dsl -o rrd -d "uSNR,dSNR,uactual,dactual,uatainable,dattainable")

See the [```rrdtool```](rrdtool/) directory for sample scripts.


InfluxDB / Grafana / Chronograf integration
===========================================

If you prefer [Grafana](https://grafana.com/) or [Chronograf](https://docs.influxdata.com/chronograf/) for plotting the data, you may find the ```-o influx``` option useful. 
This example downloads the relevant LTE and DSL status data:

    node l33tport.js -f lteInfo -o influx -k rsrp,rsrq
    node l33tport.js -f dsl     -o influx -k uactual,dactual,uattainable,dattainable,uSNR,dSNR,uCRC,dCRC,uHEC,dHEC

The output will look like this:

```
    lteInfo_rsrp value=-72
    lteInfo_rsrq value=-7
    dsl_uactual value=1167
    dsl_dactual value=13947
    dsl_uattainable value=1268
    dsl_dattainable value=13504
    dsl_uSNR value=81
    dsl_dSNR value=52
    dsl_uCRC value=223
    dsl_dCRC value=119710
    dsl_uHEC value=131
    dsl_dHEC value=501650
```

Which can be sent directly as POST request to an InfluxDB instance. See the [```influxdb```](influxdb/) directory for a sample script.


Contributors
============

Thanks to:

* [housemaister](https://github.com/housemaister)
* [Henning](https://github.com/hensur)
* [Manfred Winter](https://github.com/mahowi)
* [Manuel Mühlig](https://github.com/manuelmuehlig)
* [descilla](https://github.com/descilla)
