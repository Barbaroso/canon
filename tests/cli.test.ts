import { describe, expect, test } from "vitest";

import { createCli } from "../src/cli/index";

describe("cli", () => {
	test("has version and no subcommands", () => {
		const cli = createCli();

		expect(cli.version()).toBe("0.1.0");
		expect(cli.commands).toHaveLength(0);
	});
});
