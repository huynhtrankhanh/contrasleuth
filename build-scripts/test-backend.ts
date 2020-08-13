import test from "ava";
import split2 from "split2";
import uuid from "uuid/v4";
import { spawn } from "child_process";

enum SubmitResult {
  Success,
  Cancelled
}

const atob = (s: string) => Buffer.from(s, "base64").toString("utf-8");
const btoa = (s: string) => Buffer.from(s, "utf-8").toString("base64");

test.before(
  t =>
    new Promise((resolve, reject) => {
      t.timeout(3600000);
      const buildProcess = spawn("cd ../backend && cargo build", {
        shell: true
      });
      buildProcess.stdout.on("data", data => process.stdout.write(data));
      buildProcess.stderr.on("data", data => process.stderr.write(data));
      buildProcess.on("close", (code, signal) => {
        if (code === 0) {
          t.log("build was successful");
          resolve();
        } else {
          t.log(
            "build process terminated with exit code",
            code,
            "and signal",
            signal
          );
          reject();
        }
      });
    })
);

const getPromisePair = <T>(): [Promise<T>, (v: T) => void] => {
  let resolve;
  const promise = new Promise<T>(_resolve => {
    resolve = _resolve;
  });
  return [promise, resolve as (v: T) => void];
};

const prepare = (() => {
  const clientListenAddress = Symbol("client listen address");
  const serverListenAddress = Symbol("server listen address");
  return (
    onInventory: (i: number[][]) => void,
    onSTDOUT: (x: string) => void
  ) => {
    const randomDBName = uuid();
    const {
      stdin,
      stdout
    } = spawn(
      `../backend/target/debug/contrasleuth --database /tmp/${randomDBName}.sqlite --address 127.0.0.1:0 --reverse-address 127.0.0.1:0 --dump-inventory`,
      { shell: true }
    );

    interface Submit {
      Submit: {
        payload: number[];
        // This is a 64-bit signed integer. However JavaScript's
        // Number type can represent a reasonably large range of
        // this field.
        expiration_time: number;
        operation_id: string;
        associated_frontend_data: string;
      };
    }

    interface Query {
      Query: {
        hash: number[];
        operation_id: string;
      };
    }

    interface CancelSubmitOperation {
      CancelSubmitOperation: {
        to_be_cancelled: string;
      };
    }

    interface EstablishConnection {
      EstablishConnection: {
        address: string;
        operation_id: string;
      };
    }

    interface EstablishReverseConnection {
      EstablishReverseConnection: {
        address: string;
        operation_id: string;
      };
    }

    type Operation =
      | Submit
      | Query
      | CancelSubmitOperation
      | EstablishConnection
      | EstablishReverseConnection;

    interface Inventory {
      Inventory: number[][];
    }

    interface InventoryMessage {
      payload: number[];
      // This field should be ignored: it is a 64-bit signed
      // integer, and conversion to 64-bit double may lead to
      // precision issues.
      nonce: number;
      expiration_time: number;
    }

    interface Message {
      Message: {
        in_reply_to: string;
        message: InventoryMessage | null;
      };
    }

    interface ProofOfWorkCancelled {
      ProofOfWorkCancelled: {
        in_reply_to: string;
      };
    }

    interface ProofOfWorkCompleted {
      ProofOfWorkCompleted: {
        in_reply_to: string;
      };
    }

    interface ConnectionEstablishmentFailure {
      ConnectionEstablishmentFailure: {
        in_reply_to: string;
      };
    }

    interface ReconcileFailure {
      ReconcileFailure: {
        in_reply_to: string;
      };
    }

    interface ServerListenAddress {
      ServerListenAddress: {
        address: string;
      };
    }

    interface ClientListenAddress {
      ClientListenAddress: {
        address: string;
      };
    }

    type Response =
      | Inventory
      | Message
      | ProofOfWorkCancelled
      | ProofOfWorkCompleted
      | ConnectionEstablishmentFailure
      | ReconcileFailure
      | ServerListenAddress
      | ClientListenAddress;

    const awaitingResponseMap = new Map<string, (r: Response) => void>();

    stdin.setDefaultEncoding("utf8");
    stdout.setEncoding("utf8");

    stdout.pipe(split2()).on("data", x => {
      onSTDOUT(x as string);
    });

    const [
      serverListenAddressPromise,
      resolveServerListenAddress
    ] = getPromisePair<string>();
    const [
      clientListenAddressPromise,
      resolveClientListenAddress
    ] = getPromisePair<string>();

    stdout.pipe(split2()).on("data", _line => {
      const line = _line as string;
      const regex = /^.*\[IPC\]\s/;
      if (!regex.test(line)) return;
      const response = JSON.parse(atob(line.replace(regex, ""))) as Response;
      if ((response as Inventory).Inventory) {
        return onInventory((response as Inventory).Inventory);
      }

      {
        if ((response as Message).Message) {
          const coerced = response as Message;
          const maybeFunction = awaitingResponseMap.get(
            coerced.Message.in_reply_to
          );
          if (maybeFunction === undefined) return;
          maybeFunction(coerced);
        }

        if ((response as ProofOfWorkCancelled).ProofOfWorkCancelled) {
          const coerced = response as ProofOfWorkCancelled;
          const maybeFunction = awaitingResponseMap.get(
            coerced.ProofOfWorkCancelled.in_reply_to
          );
          if (maybeFunction === undefined) return;
          maybeFunction(coerced);
        }

        if ((response as ProofOfWorkCompleted).ProofOfWorkCompleted) {
          const coerced = response as ProofOfWorkCompleted;
          const maybeFunction = awaitingResponseMap.get(
            coerced.ProofOfWorkCompleted.in_reply_to
          );
          if (maybeFunction === undefined) return;
          maybeFunction(coerced);
        }

        if (
          (response as ConnectionEstablishmentFailure)
            .ConnectionEstablishmentFailure
        ) {
          const coerced = response as ConnectionEstablishmentFailure;
          const maybeFunction = awaitingResponseMap.get(
            coerced.ConnectionEstablishmentFailure.in_reply_to
          );
          if (maybeFunction === undefined) return;
          maybeFunction(coerced);
        }

        if ((response as ReconcileFailure).ReconcileFailure) {
          const coerced = response as ReconcileFailure;
          const maybeFunction = awaitingResponseMap.get(
            coerced.ReconcileFailure.in_reply_to
          );
          if (maybeFunction === undefined) return;
          maybeFunction(coerced);
        }
      }

      if ((response as ServerListenAddress).ServerListenAddress) {
        const coerced = response as ServerListenAddress;
        resolveServerListenAddress(coerced.ServerListenAddress.address);
      }

      if ((response as ClientListenAddress).ClientListenAddress) {
        const coerced = response as ClientListenAddress;
        resolveClientListenAddress(coerced.ClientListenAddress.address);
      }
    });

    const serialize = (operation: Operation): string =>
      btoa(JSON.stringify(operation)) + "\n";

    type Cancel = () => void;

    interface Methods {
      [clientListenAddress]: typeof clientListenAddressPromise;
      [serverListenAddress]: typeof serverListenAddressPromise;
      submit: (
        payload: number[],
        expirationTime: number,
        onResponse: (result: SubmitResult) => void
      ) => Cancel;
      query: (
        hash: number[],
        onResponse: (result: InventoryMessage | null) => void
      ) => void;
      connect: (peer: Methods, onFailure: () => void) => void;
    }

    const methods: Methods = {
      [clientListenAddress]: clientListenAddressPromise,
      [serverListenAddress]: serverListenAddressPromise,
      submit: (
        payload: number[],
        expirationTime: number,
        onResponse: (result: SubmitResult) => void
      ): Cancel => {
        const id = uuid();
        stdin.write(
          serialize({
            Submit: {
              payload,
              expiration_time: expirationTime,
              operation_id: id,
              associated_frontend_data: ""
            }
          })
        );
        awaitingResponseMap.set(id, (response): void => {
          if ((response as ProofOfWorkCancelled).ProofOfWorkCancelled) {
            return onResponse(SubmitResult.Cancelled);
          }
          if ((response as ProofOfWorkCompleted).ProofOfWorkCompleted) {
            return onResponse(SubmitResult.Success);
          }
        });
        const cancel = () => {
          stdin.write(
            serialize({
              CancelSubmitOperation: {
                to_be_cancelled: id
              }
            })
          );
        };
        return cancel;
      },
      query: (
        hash: number[],
        onResponse: (result: InventoryMessage | null) => void
      ) => {
        const id = uuid();
        stdin.write(serialize({ Query: { hash, operation_id: id } }));
        awaitingResponseMap.set(id, (_response): void => {
          const response = _response as Message;
          onResponse(response.Message.message);
        });
      },
      connect: (peer: Methods, onFailure: () => void) => {
        Promise.all([
          peer[serverListenAddress] as Promise<string>,
          peer[clientListenAddress] as Promise<string>
        ]).then(([address, reverseAddress]) => {
          const id1 = uuid();
          const id2 = uuid();
          stdin.write(
            serialize({
              EstablishConnection: { address, operation_id: id1 }
            })
          );
          stdin.write(
            serialize({
              EstablishReverseConnection: {
                address: reverseAddress,
                operation_id: id2
              }
            })
          );
          let reportedFailure = false;
          const onResponse = () => {
            if (!reportedFailure) {
              onFailure();
              reportedFailure = true;
            }
          };
          awaitingResponseMap.set(id1, onResponse);
          awaitingResponseMap.set(id2, onResponse);
        });
      }
    };

    return methods;
  };
})();

test("cancel submission", t => {
  t.timeout(120000);

  const peer = prepare(
    _ => void 8,
    message => t.log(message.trim())
  );
  return new Promise(resolve => {
    peer.submit([1], 9999999999, result => {
      t.assert(result === SubmitResult.Cancelled);
      resolve();
    })();
  });
});

test("initial reconcile round", t => {
  t.timeout(120000);

  const [peer1Consistent, resolvePeer1Consistent] = getPromisePair<void>();
  const [peer2Consistent, resolvePeer2Consistent] = getPromisePair<void>();

  const peer1 = prepare(
    items => {
      if (items.length === 2) {
        Promise.all([
          new Promise<number[]>(resolve => {
            peer1.query(items[0], result => {
              if (result === null) t.fail();
              resolve(result.payload);
            });
          }),
          new Promise<number[]>(resolve => {
            peer1.query(items[1], result => {
              if (result === null) t.fail();
              resolve(result.payload);
            });
          })
        ]).then(([[u], [v]]) => {
          if ((u === 1 && v === 2) || (u === 2 && v === 1)) {
            resolvePeer1Consistent();
          }
        });
      }
    },
    message => {
      t.log("Peer 1: " + message.trim());
    }
  );

  const peer2 = prepare(
    items => {
      if (items.length === 2) {
        Promise.all([
          new Promise<number[]>(resolve => {
            peer2.query(items[0], result => {
              if (result === null) t.fail();
              resolve(result.payload);
            });
          }),
          new Promise<number[]>(resolve => {
            peer2.query(items[1], result => {
              if (result === null) t.fail();
              resolve(result.payload);
            });
          })
        ]).then(([[u], [v]]) => {
          if ((u === 1 && v === 2) || (u === 2 && v === 1)) {
            resolvePeer2Consistent();
          }
        });
      }
    },
    message => {
      t.log("Peer 2: " + message.trim());
    }
  );

  const nearFuture = Math.trunc(Date.now() / 1000 + 3600);

  Promise.all([
    new Promise(resolve => {
      peer1.submit([1], nearFuture, resolve);
    }),
    new Promise(resolve => {
      peer2.submit([2], nearFuture, resolve);
    })
  ]).then(_ => {
    peer1.connect(peer2, () => {
      t.fail();
    });
  });

  return Promise.all([peer1Consistent, peer2Consistent]).then(() => t.pass());
});

test("reconcile on inventory change", t => {
  t.timeout(120000);

  const [peer1Consistent, resolvePeer1Consistent] = getPromisePair<void>();
  const [peer2Consistent, resolvePeer2Consistent] = getPromisePair<void>();

  const peer1 = prepare(
    items => {
      if (items.length === 2) {
        Promise.all([
          new Promise<number[]>(resolve => {
            peer1.query(items[0], result => {
              if (result === null) t.fail();
              resolve(result.payload);
            });
          }),
          new Promise<number[]>(resolve => {
            peer1.query(items[1], result => {
              if (result === null) t.fail();
              resolve(result.payload);
            });
          })
        ]).then(([[u], [v]]) => {
          if ((u === 1 && v === 2) || (u === 2 && v === 1)) {
            resolvePeer1Consistent();
          }
        });
      }
    },
    message => {
      t.log("Peer 1: " + message.trim());
    }
  );

  const peer2 = prepare(
    items => {
      if (items.length === 2) {
        Promise.all([
          new Promise<number[]>(resolve => {
            peer2.query(items[0], result => {
              if (result === null) t.fail();
              resolve(result.payload);
            });
          }),
          new Promise<number[]>(resolve => {
            peer2.query(items[1], result => {
              if (result === null) t.fail();
              resolve(result.payload);
            });
          })
        ]).then(([[u], [v]]) => {
          if ((u === 1 && v === 2) || (u === 2 && v === 1)) {
            resolvePeer2Consistent();
          }
        });
      }
    },
    message => {
      t.log("Peer 2: " + message.trim());
    }
  );

  const nearFuture = Math.trunc(Date.now() / 1000 + 3600);

  peer1.connect(peer2, () => t.fail());
  setTimeout(() => {
    peer1.submit([1], nearFuture, _ => void 8);
    peer2.submit([2], nearFuture, _ => void 8);
  }, 100);

  return Promise.all([peer1Consistent, peer2Consistent]).then(() => t.pass());
});
