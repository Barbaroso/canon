#!/usr/bin/env node
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";

export const createCli = (): Command => {
	const program = new Command();

	program.name("canon").description("CANON CLI").version("0.1.0");

	return program;
};

export const run = async (argv: string[] = process.argv): Promise<void> => {
	const program = createCli();
	await program.parseAsync(argv);
};

const isMainModule = (): boolean => {
	const entryPoint = process.argv[1];
	if (!entryPoint) {
		return false;
	}

	return fileURLToPath(import.meta.url) === resolve(entryPoint);
};

if (isMainModule()) {
	run().catch((error: unknown) => {
		console.error(error);
		process.exitCode = 1;
	});
}
