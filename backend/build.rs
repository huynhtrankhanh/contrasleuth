extern crate capnpc;

fn main() {
    ::capnpc::CompilerCommand::new()
        .file("capnp/reconcile.capnp")
        .run()
        .unwrap();

    ::capnpc::CompilerCommand::new()
        .file("capnp/message.capnp")
        .run()
        .unwrap();
}
