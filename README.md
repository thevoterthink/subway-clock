# Subway Clock

A home NYC subway countdown clock for Cathedral Pkwy (110 St), downtown B/C/A and 1.
It's a single web page that reads the MTA's public GTFS-realtime feeds directly in the
browser. There's no server and no API key.

Live page: https://thevoterthink.github.io/subway-clock/

To change the station or lines, edit the `CONFIG` block near the top of `index.html`.
Stop IDs come from the MTA static GTFS `stops.txt`.

## San Francisco (Muni) version
`sf/` is the same clock for Muni: the 5 and 5R inbound at McAllister & Baker and
McAllister & Divisadero, using 511.org real-time data.

Live page: https://thevoterthink.github.io/subway-clock/sf/

511.org requires a free API key (https://511.org/open-data/token). The key is not stored
in this repo: enter it on the page the first time, or open `.../sf/#key=YOUR_KEY` once.
It's then saved in that browser only. Each key allows 60 requests per hour, and the page
uses about 52 per hour, so run one open copy per key.
