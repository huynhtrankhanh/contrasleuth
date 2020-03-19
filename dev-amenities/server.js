const io = require("socket.io")(2020);
const { spawn } = require("child_process");

const buildProcess = spawn("cd ../backend && cargo build", { shell: true });
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
    "../backend/target/debug/parlance --address 127.0.0.1:0 --database backend.sqlite --frontend-database frontend.sqlite",
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

  stdout.on("data", data => {
    process.stdout.write(data);
    io.emit("stdout", data);
  });

  stderr.on("data", data => {
    process.stdout.write(data);
  });
};
