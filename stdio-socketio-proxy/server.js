const io = require("socket.io")(2020);
const { spawn } = require("child_process");
const split2 = require("split2");

const buildProcess = spawn("cd ../backend && cargo build --release", { shell: true });
buildProcess.stdout.on("data", data => process.stdout.write(data));
buildProcess.stderr.on("data", data => process.stderr.write(data));
buildProcess.on("close", (code, signal) => {
  if (code === 0) {
    process.stdout.write("Build was successful.\n");
    proceed();
  } else {
    process.stdout.write(
      "Build process terminated with exit code " +
        code +
        " and signal " +
        signal +
        "\n"
    );
  }
});

const proceed = () => {
  const { stdin, stdout, stderr } = spawn(
    "../backend/target/release/contrasleuth --address 127.0.0.1:0 --database backend.sqlite --frontend-database frontend.sqlite",
    {
      shell: true
    }
  );
  stdin.setEncoding("utf8");
  stdout.setEncoding("utf8");

  io.on("connection", socket => {
    socket.on("stdin", data => {
      stdin.write(data);
    });
  });

  stdout.pipe(split2()).on("data", data => {
    process.stdout.write(data + "\n");
    io.emit("stdout", data);
  });

  stderr.on("data", data => {
    process.stdout.write(data);
  });
};
