import program from "commander";
import pkg from "../package.json";
import transform from "./transform";
import chalk from "chalk";

program
    .version(pkg.version)
    .description(
        `${pkg.description}
  <src>: The source directory / file that contains typescript build result.
  [dst]: Optional. The destination directory / file. If not provided, output will replace the <src>.`
    )
    .arguments("<src> [dst]")
    .action(async (src, dst)=>{
        try{
            await transform(src, dst);
        }catch(e){
            console.log(chalk.red(`Error: ${e}`));
        }
    })
    .parse(process.argv);

if (!process.argv.slice(2).length) {
    program.help();
}
