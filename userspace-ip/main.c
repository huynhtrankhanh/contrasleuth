#include "lwip/opt.h"
#if LWIP_NETCONN
#include "lwip/sys.h"
#include "lwip/api.h"
#include "default_netif.h"
int main()
{
    ip4_addr_t ip_address = { .addr = 3232235876 /* 192.168.1.100 */ };
    ip4_addr_t netmask =  { .addr = 4294967040 /* 255.255.255.0 */ };
    ip4_addr_t default_gateway = { .addr = 3232235777 /* 192.168.1.1 */ };
    init_default_netif(&ip_address, &netmask, &default_gateway);
    struct netconn *connection = netconn_new_with_proto_and_callback(NETCONN_TCP, 0, NULL);
}
#endif
