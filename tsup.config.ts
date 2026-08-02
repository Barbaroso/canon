import { defineConfig } from "tsup";

export default defineConfig({
	entry: {
		cli: "src/cli/index.ts",
	},
	format: ["esm"],
	platform: "node",
	target: "node22",
	outDir: "dist",
	clean: true,
});
