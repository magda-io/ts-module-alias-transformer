/// <reference types="./missing" />

import fs from "fs";
import fse from "fs-extra";
import path from "path";
import mkDir from "make-dir";
import recursiveReadDir from "recursive-readdir";
import slash from "slash";
import * as babel from "@babel/core";
import chalk from "chalk";
import typescriptSyntaxPlugin from "@babel/plugin-syntax-typescript";
import moduleResolverPlugin from "babel-plugin-module-resolver";

const CONFIG_KEY = "_moduleMappings";

export interface MappingConfigType {
    [key: string]: string;
}

const DefaultBabelOption = {
    compact: false,
    retainLines: true,
    minified: false,
    sourceMaps: false,
    comments: true,
    code: true,
    // Don't let a consumer's babel config (babel.config.*, .babelrc) interfere
    // with parsing. We only want the plugins we specify below to be active.
    configFile: false,
    babelrc: false
};

function isTsDefinitionFile(filePath: string) {
    const ext = filePath
        .split(".")
        .slice(1)
        .join(".");
    return ext === "d.ts";
}

function getBabelOption(
    filePath: string,
    mappingConfig: MappingConfigType,
    isTsDefinitionFile: boolean
) {
    if (!isTsDefinitionFile) {
        return {
            ...DefaultBabelOption,
            plugins: [
                [
                    moduleResolverPlugin,
                    {
                        root: [path.dirname(filePath)],
                        alias: { ...mappingConfig }
                    }
                ]
            ]
        };
    } else {
        return {
            ...DefaultBabelOption,
            plugins: [
                // `dts: true` is required to parse declaration-only syntax
                // (e.g. `export default interface`, ambient `declare`,
                // `readonly` class fields) found in `.d.ts` files.
                [typescriptSyntaxPlugin, { dts: true }],
                [
                    moduleResolverPlugin,
                    {
                        root: [path.dirname(filePath)],
                        alias: { ...mappingConfig }
                    }
                ]
            ]
        };
    }
}

async function getAliasConfig(mappingConfigPath?: string) {
    let runtimeMappingConfigPath = mappingConfigPath;

    if (runtimeMappingConfigPath) {
        runtimeMappingConfigPath = path.resolve(runtimeMappingConfigPath);
        if (!fs.existsSync(runtimeMappingConfigPath)) {
            throw new Error(
                `Can't locate package.json at: ${runtimeMappingConfigPath}`
            );
        }
    } else {
        runtimeMappingConfigPath = "./package.json";
        runtimeMappingConfigPath = path.resolve(runtimeMappingConfigPath);
        if (!fs.existsSync(runtimeMappingConfigPath)) {
            throw new Error(
                `Can't locate package.json at current working directory.`
            );
        }
    }

    const pkgJson = await fse.readJSON(runtimeMappingConfigPath);
    if (!pkgJson[CONFIG_KEY]) {
        throw new Error(
            `Can't locate \`${CONFIG_KEY}\` property from package.json.`
        );
    }
    if (typeof pkgJson[CONFIG_KEY] !== "object") {
        throw new Error(
            `The \`${CONFIG_KEY}\` property of package.json must be a object.`
        );
    }
    if (!Object.keys(pkgJson[CONFIG_KEY]).length) {
        throw new Error(
            `The \`${CONFIG_KEY}\` property of package.json can't be an empty object.`
        );
    }
    return pkgJson[CONFIG_KEY];
}

async function transform(
    src: string,
    dst?: string,
    mappingConfigPath?: string
) {
    const srcPath = slash(path.resolve(src));
    if (!fs.existsSync(srcPath)) {
        throw new Error(`Src path: \`${src}\` doesn't exist.`);
    }

    const dstPath: string = dst ? slash(path.resolve(dst)) : srcPath;
    if (!fs.existsSync(dstPath)) {
        await mkDir(dstPath);
    }
    const srcStat = fs.statSync(srcPath);
    const dstStat = fs.statSync(dstPath);
    const isSrcDirectory = srcStat.isDirectory();
    const isDstDirectory = dstStat.isDirectory();

    let srcList: string[];
    if (isSrcDirectory) {
        if (!isDstDirectory) {
            throw new Error(
                `Destination path: \`${dst}\` must be a directory when src is a directory.`
            );
        }

        srcList = await recursiveReadDir(srcPath, [
            (filePath, stats) => {
                if (!stats.isDirectory()) {
                    const fileName = path.basename(filePath);
                    const ext = fileName
                        .split(".")
                        .slice(1)
                        .join(".");
                    if (ext === "js" || ext === "d.ts") return false;
                    else return true;
                }

                return false;
            }
        ]);
    } else {
        srcList = [srcPath];
    }

    const mappingConfig = await getAliasConfig(mappingConfigPath);
    let processCount = 0;
    const failedFiles: string[] = [];

    // Process every file independently. A parse error on one file must not
    // abort the whole run and leave sibling files silently un-rewritten
    // (which would produce a broken build output). We collect failures and
    // surface them as a hard error after all files have been attempted.
    for (let i = 0; i < srcList.length; i++) {
        const filePath = slash(srcList[i]);
        try {
            const result = await transformFile(
                filePath,
                srcPath,
                isSrcDirectory,
                dstPath,
                isDstDirectory,
                mappingConfig
            );
            if (result) {
                processCount++;
            }
        } catch (e) {
            failedFiles.push(filePath);
            console.log(
                chalk.red(
                    `Failed to transform \`${filePath}\`: ${
                        e instanceof Error ? e.message : e
                    }`
                )
            );
        }
    }

    console.log(`Successfully compiled ${processCount} files with Babel.`);

    if (failedFiles.length) {
        throw new Error(
            `Failed to transform ${failedFiles.length} file(s):\n` +
                failedFiles.map((f) => `  - ${f}`).join("\n")
        );
    }
}

// Matches triple-slash `/// <reference types="..." />` directives, capturing
// the type path plus any trailing attributes (e.g. `resolution-mode="require"`)
// so they are preserved when the type path is remapped.
const directiveRegEx = /^\/\/\/\s*<reference\s+types="([^"]+)"([^>]*)\/>/gim;

function processMappingConfig(
    modulePath: string,
    mappingConfig: MappingConfigType
) {
    const fromModuleList = Object.keys(mappingConfig);

    for (let i = 0; i < fromModuleList.length; i++) {
        const fromModule = fromModuleList[i];
        const toModule = mappingConfig[fromModule];
        if (modulePath === fromModule) {
            return toModule;
        }
        if (modulePath.indexOf(fromModule) === 0) {
            return toModule + modulePath.substr(fromModule.length);
        }
    }

    return modulePath;
}

function processTypeDirective(code: string, mappingConfig: MappingConfigType) {
    return code.replace(
        directiveRegEx,
        (match, typePath: string, rest: string) =>
            `/// <reference types="${processMappingConfig(
                typePath,
                mappingConfig
            )}"${rest}/>`
    );
}

function getDstFilePath(
    filePath: string,
    srcPath: string,
    isSrcDirectory: boolean,
    dstPath: string,
    isDstDirectory: boolean
) {
    if (!isDstDirectory) {
        return dstPath;
    }
    if (!isSrcDirectory) {
        return path.join(dstPath, path.basename(filePath));
    }
    return path.join(dstPath, path.relative(srcPath, filePath));
}

async function transformFile(
    filePath: string,
    srcPath: string,
    isSrcDirectory: boolean,
    dstPath: string,
    isDstDirectory: boolean,
    mappingConfig: MappingConfigType
) {
    const isTsFile = isTsDefinitionFile(filePath);
    const babelOptions = getBabelOption(filePath, mappingConfig, isTsFile);

    const result = await babel.transformFileAsync(filePath, babelOptions);

    if (!result?.code) {
        console.log(chalk.yellow(`Input ${filePath} has no output.`));
        return false;
    }
    const code = isTsFile
        ? processTypeDirective(result.code, mappingConfig)
        : result.code;
    const dstFilePath = getDstFilePath(
        filePath,
        srcPath,
        isSrcDirectory,
        dstPath,
        isDstDirectory
    );

    const dstFileDir = path.dirname(dstFilePath);
    if (!fs.existsSync(dstFileDir)) {
        await mkDir(dstFileDir);
    }

    await fse.writeFile(dstFilePath, code);
    return true;
}

export default transform;
