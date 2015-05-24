#!/bin/bash
set -eu

DSLDB=dsl.rrd
LTEDB=lteinfo.rrd
OUTPUTDIR=/var/www/default/stats

# Pleasant colors from
# https://oss.oetiker.ch/rrdtool-trac/wiki/OutlinedAreaGraph
#
#          LIGHT   DARK
# RED     #EA644A #CC3118
# ORANGE  #EC9D48 #CC7016
# YELLOW  #ECD748 #C9B215
# GREEN   #54EC48 #24BC14
# BLUE    #48C4EC #1598C3
# PINK    #DE48EC #B415C7
# PURPLE  #7648EC #4D18E4



# Graphs DSL values. The scaling is pretty bogus.
#
# $1 - filenme
# $2 - title
# $3 - starttime
# $4 - endtime
function drawDSL
{
    rm -f $OUTPUTDIR/$1

    rrdtool graph $OUTPUTDIR/$1 \
        -s $3 \
        -e $4 \
        -t "$2" \
        -h 200 \
        -w 600 \
        -a PNG \
        -v "Upstream / Downstream" \
		--upper-limit 16000 --rigid \
        DEF:dactual=$DSLDB:dactual:AVERAGE \
        DEF:dattainable=$DSLDB:dattainable:AVERAGE \
        DEF:uactual=$DSLDB:uactual:AVERAGE \
        DEF:uattainable=$DSLDB:uattainable:AVERAGE \
        DEF:uLine=$DSLDB:uLine:AVERAGE \
        DEF:dLine=$DSLDB:dLine:AVERAGE \
        DEF:uSNR=$DSLDB:uSNR:AVERAGE \
        DEF:dSNR=$DSLDB:dSNR:AVERAGE \
        DEF:dHEC=$DSLDB:dHEC:MAX \
        DEF:dCRC=$DSLDB:dCRC:MAX \
        CDEF:dCRCScaled=dCRC,20000,* \
        CDEF:dHECScaled=dHEC,20000,* \
        CDEF:uLineScaled=uLine,10,* \
        CDEF:dLineScaled=dLine,10,* \
        CDEF:uSNRScaled=uSNR,80,* \
        CDEF:dSNRScaled=dSNR,80,* \
        CDEF:dHECOutline=dHECScaled,dCRCScaled,dHECScaled,+,UNKN,IF \
        \
        AREA:dattainable#54EC48CC \
        LINE1:dattainable#24BC14:"dattainable"  \
        LINE1:dactual#ff3535:"dactual"  \
        AREA:uattainable#48C4EC \
        LINE1:uattainable#1598C3:"uattainable" \
        LINE1:uactual#0000FF:"uactual"  \
        AREA:dHECScaled#EC9D48AA:"Header Errors" \
        AREA:dCRCScaled#ECD748AA:"CRC Errors":STACK \
        LINE1:dHECScaled#CC7016AA  \
        LINE1:dHECOutline#C9B215AA \
        LINE1:uSNRScaled#DE48EC:"uSNR" \
        LINE1:dSNRScaled#B415C7:"dSNR" \
		LINE1:uLineScaled#7648EC:"uLine" \
		LINE1:dLineScaled#4D18E4:"dLine\n" \
		\
		GPRINT:dattainable:LAST:"dattainable\:%1.0lf kBps\t" \
		GPRINT:dactual:LAST:"dactual\:%1.0lf kBps\t" \
		GPRINT:dSNR:LAST:"dSNR\:%1.0lf \n" \
		\
		GPRINT:uattainable:LAST:"uattainable\:%1.0lf kBps\t" \
		GPRINT:uactual:LAST:"uactual\:%1.0lf kBps\t" \
		GPRINT:uSNR:LAST:"uSNR\:%1.0lf \n" 
	
}

# Graph LTE values
#
# $1 - filenme
# $2 - title
# $3 - starttime
# $4 - endtime
function drawLTE
{
    rm -f $OUTPUTDIR/$1

    rrdtool graph $OUTPUTDIR/$1 \
       -s $3 \
       -e $4 \
       -t "$2" \
       -h 200 \
       -w 600 \
       -a PNG \
	   --right-axis 0.1:0 \
	   --right-axis-label "rsrq" \
       DEF:rsrp=$LTEDB:rsrp:AVERAGE \
       DEF:rsrq=$LTEDB:rsrq:AVERAGE \
	   CDEF:rsrqScaled=rsrq,10,* \
       \
       AREA:rsrp#54EC48CC \
       LINE1:rsrp#24BC14:"rsrp"  \
       AREA:rsrqScaled#48C4EC \
       LINE1:rsrqScaled#1598C3:"rsrq" \
	   \
        GPRINT:rsrp:AVERAGE:"Ø rsrp\:%1.0lf dB\t" \
    	GPRINT:rsrq:AVERAGE:"Ø rsrq\:%1.0lf dB\t" \
    	GPRINT:rsrp:LAST:"last rsrp\:%1.0lf dB\t" \
    	GPRINT:rsrq:LAST:"last rsrq\:%1.0lf dB\t" \
	
}

drawDSL	dsl-1h.png	"DSL last hour"		end-1h now	&
drawDSL	dsl-48h.png	"DSL line status"	end-48h now	&

drawLTE	lteinfo-1h.png	"LTE 1h"	end-1h now	&
drawLTE	lteinfo-48h.png	"LTE 48h"	end-48h now	&

for job in `jobs -p`
do
    wait $job 
done
