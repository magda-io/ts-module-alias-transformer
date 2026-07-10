import { describe, it } from "node:test";
import assert from "node:assert/strict";
import childProcess from "child_process";
import recursiveReadDir from "recursive-readdir";
import { MappingConfigType } from "../transform.js";
import tmp from "tmp";
import fs from "fs-extra";
import path from "path";
import _ from "lodash";
import { __dirname as getCurrentDirName } from "../esmUtils.js";

const __dirname = getCurrentDirName();

const DIR_CREATE_OPTIONS = {
    unsafeCleanup: true
};

const testFileExtList = [
    "js.from.txt",
    "js.to.txt",
    "d.ts.from.txt",
    "d.ts.to.txt"
];

const DEFAULT_MAPPING_CONFIG = {
    "a/b/c": "@m1/a/b/c/dist"
};

const entryPoint = path.resolve(__dirname, "../index.ts");

/**
 * Run the CLI (via `tsx`) against a source directory and return the spawn
 * result (including exit `status`), without throwing on a non-zero exit.
 */
function runCli(configPath: string, srcDir: string, dstDir: string) {
    return childProcess.spawnSync(
        process.execPath,
        ["--import", "tsx", entryPoint, "-p", configPath, srcDir, dstDir],
        {
            encoding: "utf8",
            cwd: path.resolve(__dirname, "../..")
        }
    );
}

async function testDir(dirPath: string, mappingOptions: MappingConfigType) {
    const configFile = tmp.fileSync();
    await fs.writeJSON(configFile.name, { _moduleMappings: mappingOptions });

    const srcDir = tmp.dirSync(DIR_CREATE_OPTIONS);
    const dstDir = tmp.dirSync(DIR_CREATE_OPTIONS);

    let testFileList = await recursiveReadDir(dirPath, [
        (filePath, stats) => {
            if (!stats.isDirectory()) {
                const fileName = path.basename(filePath);
                const ext = fileName.split(".").slice(1).join(".");
                if (testFileExtList.indexOf(ext) !== -1) {
                    return false;
                } else {
                    return true;
                }
            }
            return false;
        }
    ]);

    testFileList = _.uniq(
        testFileList.map((filePath) => {
            const fileName = path.basename(filePath);
            const fileParts = fileName.split(".");
            const basename = fileParts.slice(0, -2).join(".");
            return path.join(path.dirname(filePath), basename);
        })
    );

    const resultFileList = testFileList.map((filePath) => {
        const basename = path.basename(filePath);
        const targetFile = path.join(srcDir.name, basename);
        fs.copyFileSync(`${filePath}.from.txt`, targetFile);
        return [`${filePath}.to.txt`, path.join(dstDir.name, basename)];
    });

    const result = runCli(configFile.name, srcDir.name, dstDir.name);
    assert.equal(
        result.status,
        0,
        `CLI exited with ${result.status}.\n${result.stdout}\n${result.stderr}`
    );

    for (let i = 0; i < resultFileList.length; i++) {
        const [sampleFile, resultFile] = resultFileList[i];
        const resultFileContent = await fs.readFile(resultFile, {
            encoding: "utf8"
        });
        const sampleFileContent = await fs.readFile(sampleFile, {
            encoding: "utf8"
        });
        assert.equal(resultFileContent.trim(), sampleFileContent.trim());
    }
}

describe("Test Process Test Files", () => {
    process.env.NODE_ENV = "production";

    it("es2022-esm target code should be processed correctly", async () => {
        await testDir(path.resolve(__dirname, "./testFiles/es2022-esm"), {
            "magda-typescript-common/src": "@magda/typescript-common/dist"
        });
    });

    it("es5 target code should be processed correctly", async () => {
        await testDir(
            path.resolve(__dirname, "./testFiles/es5"),
            DEFAULT_MAPPING_CONFIG
        );
    });

    it("es2015 target code should be processed correctly", async () => {
        await testDir(
            path.resolve(__dirname, "./testFiles/es2015"),
            DEFAULT_MAPPING_CONFIG
        );
    });

    it(".d.ts file should be processed correctly", async () => {
        await testDir(
            path.resolve(__dirname, "./testFiles/d.ts"),
            DEFAULT_MAPPING_CONFIG
        );
    });

    it(".d.ts file with declaration-only syntax should be processed correctly", async () => {
        await testDir(
            path.resolve(__dirname, "./testFiles/d.ts-declaration"),
            DEFAULT_MAPPING_CONFIG
        );
    });
});

describe("Fail-safe behaviour", () => {
    it("should exit non-zero and still rewrite sibling files when one file can't be parsed", async () => {
        const configFile = tmp.fileSync();
        await fs.writeJSON(configFile.name, {
            _moduleMappings: DEFAULT_MAPPING_CONFIG
        });

        const srcDir = tmp.dirSync(DIR_CREATE_OPTIONS);
        const dstDir = tmp.dirSync(DIR_CREATE_OPTIONS);

        // A genuinely un-parseable declaration file that sorts *before* the
        // valid sibling, reproducing the real-world ordering from the bug report.
        await fs.writeFile(
            path.join(srcDir.name, "AAA.d.ts"),
            "export default interface X { @@@ not valid @@@ }\n"
        );
        // A valid sibling whose imports must still be rewritten.
        await fs.writeFile(
            path.join(srcDir.name, "index.js"),
            'import x from "a/b/c/mod";\nexport default x;\n'
        );

        const result = runCli(configFile.name, srcDir.name, dstDir.name);

        // 1. Must fail loudly (non-zero exit) rather than silently succeed.
        assert.notEqual(
            result.status,
            0,
            `Expected a non-zero exit code on parse failure.\n${result.stdout}\n${result.stderr}`
        );

        // 2. The valid sibling must still have been rewritten (no silent skip).
        const rewritten = await fs.readFile(
            path.join(dstDir.name, "index.js"),
            { encoding: "utf8" }
        );
        assert.match(rewritten, /@m1\/a\/b\/c\/dist\/mod/);
    });
});
