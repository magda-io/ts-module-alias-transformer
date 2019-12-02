import program from "commander";
import pkg from "../package.json";
import transform from "./transform";
import chalk from "chalk";

program
    .name("ts-module-alias-transformer")
    .version(pkg.version)
    .description(
        `${pkg.description}
  <src>: The source directory / file that contains typescript build result.
  [dst]: Optional. The destination directory / file. If not provided, output will replace the <src>.`
    )
    .arguments("<src> [dst]")
    .option(
        "-p, --mappingConfigPath <packageJsonPath>",
        "Optional. Specify the mapping config json file location. \n"+
        "By default, it will read the `_moduleMappings` field of package.json in current working directory to determine the module paths to replace. \n"+
        "See https://github.com/t83714/ts-module-alias-transformer for more details."
    )
    .action(async (src, dst, program) => {
        try {
            await transform(src, dst, program.mappingConfigPath);
        } catch (e) {
            console.log(chalk.red(`Error: ${e}`));
        }
    })
    .parse(process.argv);

if (!process.argv.slice(2).length) {
    program.help();
}
