#!/usr/bin/env node
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

void run();
