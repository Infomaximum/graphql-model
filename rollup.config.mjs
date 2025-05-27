// @ts-check
import packageJson from "./package.json" with { type: "json" };
import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import del from "rollup-plugin-delete";
import { dts } from "rollup-plugin-dts";

const externalPackages = [
  ...Object.keys(packageJson.dependencies || {}),
  ...Object.keys(packageJson.peerDependencies || {}),
];

const regexesOfPackages = externalPackages.map(
  (packageName) => new RegExp(`^${packageName}(\/.*)?`)
);

/** @type {import("rollup").RollupOptions[]} */
const config = [
  {
    input: "index.ts",
    output: [
      {
        file: "dist/index.js",
        format: "cjs",
        sourcemap: true,
      },
      {
        file: "dist/index.esm.js",
        format: "es",
        sourcemap: true,
      },
    ],
    plugins: [
      del({ targets: "dist", hook: "buildStart", runOnce: true }),
      typescript(),
      resolve(),
      commonjs(),
    ],
    external: regexesOfPackages,
  },
  {
    input: "dist/dts/index.d.ts",
    output: [{ file: "dist/index.d.ts", format: "es" }],
    plugins: [
      dts(),
      del({ targets: "dist/dts", hook: "buildEnd", runOnce: true }),
    ],
  },
];

export default config;
