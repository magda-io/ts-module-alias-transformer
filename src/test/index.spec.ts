import {} from "mocha";
import { expect } from "chai";
import childProcess from "child_process";
import recursiveReadDir from "recursive-readdir";
import { MappingConfigType } from "../transform";
import tmp from "tmp";
import fs from "fs-extra";
import path from "path";
import _ from "lodash";

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

async function testDir(dirPath: string, mappingOptions: MappingConfigType) {
    const configFile = tmp.fileSync();
    await fs.writeJSON(configFile.name, { _moduleMappings: mappingOptions });

    const srcDir = tmp.dirSync(DIR_CREATE_OPTIONS);
    const dstDir = tmp.dirSync(DIR_CREATE_OPTIONS);

    let testFileList = await recursiveReadDir(dirPath, [
        (filePath, stats) => {
            if (!stats.isDirectory()) {
                const fileName = path.basename(filePath);
                const ext = fileName
                    .split(".")
                    .slice(1)
                    .join(".");
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
        testFileList.map(filePath => {
            const fileName = path.basename(filePath);
            const fileParts = fileName.split(".");
            const basename = fileParts.slice(0, -2).join(".");
            return path.join(path.dirname(filePath), basename);
        })
    );

    const resultFileList = testFileList.map(filePath => {
        const basename = path.basename(filePath);
        const targetFile = path.join(srcDir.name, basename);
        fs.copyFileSync(`${filePath}.from.txt`, targetFile);
        return [`${filePath}.to.txt`, path.join(dstDir.name, basename)];
    });

    const tsconfigPath = path.resolve("tsconfig.json");
    const tsNodeExec = require.resolve("ts-node/dist/bin.js");
    const entryPoint = path.resolve(__dirname, "../index.ts");

    childProcess.execSync(
        `${tsNodeExec} ${entryPoint} -p ${configFile.name} ${srcDir.name} ${dstDir.name}`,
        {
            stdio: "inherit",
            cwd: path.dirname(tsconfigPath),
            env: {
                ...(process.env ? process.env : {}),
                TS_NODE_PROJECT: tsconfigPath
            }
        }
    );

    for (let i = 0; i < resultFileList.length; i++) {
        const [sampleFile, resultFile] = resultFileList[0];
        const resultFileContent = await fs.readFile(resultFile, {
            encoding: "utf8"
        });
        const sampleFileContent = await fs.readFile(sampleFile, {
            encoding: "utf8"
        });
        expect(sampleFileContent.trim()).to.be.equal(resultFileContent.trim());
    }
}

describe("Test Process Test Files", async () => {
    
    process.env.NODE_ENV = "production";

    it("es5 target code should be processed correctly", async () => {
        await testDir(
            path.resolve(__dirname, "./testFiles/es5"),
            DEFAULT_MAPPING_CONFIG
        );
    }).timeout(30000);

    it("es2015 target code should be processed correctly", async () => {
        await testDir(
            path.resolve(__dirname, "./testFiles/es2015"),
            DEFAULT_MAPPING_CONFIG
        );
    }).timeout(30000);

    it(".d.ts file should be processed correctly", async () => {
        await testDir(
            path.resolve(__dirname, "./testFiles/d.ts"),
            DEFAULT_MAPPING_CONFIG
        );
    }).timeout(30000);
});
