const { spawn } = require("child_process");
const lakeBin = process.env.HOME + "/.elan/bin/lake";
const cwd = "/Users/kevin/projects/perqed/agent_workspace/runs/erdos_problem_265_rational_sums/runs/run_1777400172528_formal";
console.log("Spawning", lakeBin, "in", cwd);
const proc = spawn(lakeBin, ["exe", "repl"], { cwd });
proc.stdout.on("data", d => console.log("STDOUT:", d.toString()));
proc.stderr.on("data", d => console.log("STDERR:", d.toString()));
proc.on("error", e => console.error("ERROR:", e));
proc.on("exit", (code, signal) => console.log("EXIT:", code, signal));
