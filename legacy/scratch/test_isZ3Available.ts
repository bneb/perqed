import { isZ3Available } from "./src/search/z3_ramsey_solver";
isZ3Available().then(console.log).catch(console.error);
