#!/bin/sh
#
# Adjust the values to your influxdb instance:
INFLUXDB=https://influx.instance:8086
DATABASE=speedport
USERNAME=l33tport
PASSWORD=secret

FILE=$(mktemp)

node l33tport.js -f dsl -o influx -k uactual,dactual,uattainable,dattainable,uSNR,dSNR,uCRC,dCRC,uHEC,dHEC >> $FILE
node l33tport.js -f lteinfo -o influx -k rsrp,rsrq >> $FILE

curl -s -XPOST $INFLUXDB/write?db=$DATABASE -u $USERNAME:$PASSWORD  --data-binary @$FILE
rm $FILE
