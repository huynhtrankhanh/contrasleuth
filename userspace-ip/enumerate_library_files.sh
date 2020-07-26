#!/bin/sh
ls ./lwip/src/api/*.c > files.txt
ls ./lwip/src/core/*.c >> files.txt
ls ./lwip/src/core/ipv4/*.c >> files.txt
ls ./lwip/src/core/ipv6/*.c >> files.txt
ls ./lwip/src/netif/*.c >> files.txt
ls ./lwip/src/netif/ppp/*.c >> files.txt
ls ./lwip/src/netif/ppp/polarssl/*.c >> files.txt
ls ./lwip/src/include/compat/*.h >> files.txt
ls ./lwip/src/include/compat/posix/arpa/*.h >> files.txt
ls ./lwip/src/include/compat/posix/net/*.h >> files.txt
ls ./lwip/src/include/compat/posix/sys/*.h >> files.txt
ls ./lwip/src/include/compat/stdc/*.h >> files.txt
ls ./lwip/src/include/lwip/*.h >> files.txt
ls ./lwip/src/include/lwip/apps/*.h >> files.txt
ls ./lwip/src/include/lwip/priv/*.h >> files.txt
ls ./lwip/src/include/lwip/prot/*.h >> files.txt
