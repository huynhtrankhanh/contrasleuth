@0xcdbd9ec1c7981634;

struct Message @0x8ca456d83a6c1502 {
    payload @0 :Data;
    nonce @1 :Int64;
    expirationTime @2 :Int64;
}

interface Reconcile @0xe41cab0b15336372 {
    test @0 (hash :Data) -> (exists :Bool);
    submit @1 (message :Message);
}
