const path = require("path");

module.exports = {
    entry: "./src/index.ts",
    mode: "production",
    target: "node",
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: "ts-loader",
                exclude: /node_modules/
            }
        ]
    },
    stats: "errors-only",
    optimization: {
        minimize: true
    },
    resolve: {
        extensions: [".tsx", ".ts", ".js"]
    },
    output: {
        filename: "index.js",
        path: path.resolve(__dirname, "./lib")
    }
};
