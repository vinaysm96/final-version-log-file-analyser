import { parseLine } from "./src/lib/parser/logParser.js";
import fs from "fs";

const line = '2001:4860:7:805::d3 - - [04/Sep/2025:12:20:08 +0530] "GET /blogs/how-to-join-indian-army HTTP/1.1" 200 80801 "https://www.google.com/" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML';

console.log("Parsing line:", line);
const result = parseLine(line);
console.log("Result:", result);
