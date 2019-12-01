"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const email_validator_1 = __importDefault(require("email-validator"));
const lodash_1 = __importDefault(require("lodash"));
const unionToThrowable_1 = __importDefault(require("magda-typescript-common/src/util/unionToThrowable"));
const status_1 = require("magda-typescript-common/src/express/status");
const mail_1 = require("./mail");
const renderTemplate_1 = __importStar(require("./renderTemplate"));
const EMAIL_REGEX = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/;
function validateMiddleware(req, res, next) {
    const body = req.body;
    if (!body.message || !body.senderEmail || !body.senderName) {
        res.status(400).json({
            status: "Failure",
            error: "Missing input"
        });
    }
    else if (!email_validator_1.default.validate(body.senderEmail)) {
        res.status(400).json({
            status: "Failure",
            error: "Invalid email: " + body.senderEmail
        });
    }
    else {
        next();
    }
}
function createApiRouter(options) {
    const router = express_1.default.Router();
    const status = {
        probes: {
            k8s: () => __awaiter(this, void 0, void 0, function* () {
                yield options.smtpMailer.checkConnectivity();
                return {
                    ready: true
                };
            })
        }
    };
    status_1.installStatusRouter(router, status);
    status_1.installStatusRouter(router, status, "/public");
    /**
     * @apiGroup Correspondence API
     *
     * @api {post} /v0/send/dataset/request Send Dataset Request
     *
     * @apiDescription Sends a request for a dataset to the site administrators
     *
     * @apiParam (Request body) {string} senderName The name of the sender
     * @apiParam (Request body) {string} senderEmail The email address of the sender
     * @apiParam (Request body) {string} message The message to send
     *
     * @apiSuccess {string} status OK
     *
     * @apiSuccessExample {json} 200
     *    {
     *         "status": "OK"
     *    }
     *
     * @apiError {string} status FAILED
     *
     * @apiErrorExample {json} 400
     *    {
     *         "status": "Failed"
     *    }
     */
    router.post("/public/send/dataset/request", validateMiddleware, function (req, res) {
        const body = req.body;
        const subject = `Data Request from ${body.senderName}`;
        const html = renderTemplate_1.default(options.templateRender, renderTemplate_1.Templates.Request, body, subject, options.externalUrl);
        handlePromise(html.then(({ renderedContent, attachments }) => {
            return mail_1.sendMail(options.smtpMailer, options.defaultRecipient, body, renderedContent, attachments, subject, options.defaultRecipient);
        }), res);
    });
    /**
     * @apiGroup Correspondence API
     *
     * @api {post} /v0/send/dataset/:datasetId/question Send a question about a dataest
     *
     * @apiDescription Sends a question about a dataset to the data custodian if available,
     *  and to the administrators if not
     *
     * @apiParam (Request body) {string} senderName The name of the sender
     * @apiParam (Request body) {string} senderEmail The email address of the sender
     * @apiParam (Request body) {string} message The message to send
     *
     * @apiSuccess {string} status OK
     *
     * @apiSuccessExample {json} 200
     *    {
     *         "status": "OK"
     *    }
     *
     * @apiError {string} status FAILED
     *
     * @apiErrorExample {json} 400
     *    {
     *         "status": "Failed"
     *    }
     */
    router.post("/public/send/dataset/:datasetId/question", validateMiddleware, function (req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const body = req.body;
            const promise = getDataset(req.params.datasetId).then(dataset => {
                const dcatDatasetStrings = dataset.aspects["dcat-dataset-strings"];
                const contactPointEmailMatches = dcatDatasetStrings.contactPoint &&
                    dcatDatasetStrings.contactPoint.match(EMAIL_REGEX);
                const contactPointEmail = contactPointEmailMatches &&
                    contactPointEmailMatches.length > 1 &&
                    contactPointEmailMatches[1];
                const datasetPublisher = dataset.aspects["dataset-publisher"];
                const datasetPublisherEmailMatches = lodash_1.default.get(datasetPublisher, "publisher.aspects.organization-details.email", "").match(EMAIL_REGEX);
                const datasetPublisherEmail = datasetPublisherEmailMatches &&
                    datasetPublisherEmailMatches.length > 1 &&
                    datasetPublisherEmailMatches[1];
                const emails = [contactPointEmail, datasetPublisherEmail]
                    .filter(email => !!email)
                    .filter(email => email !== "")
                    .filter(email => email_validator_1.default.validate(email));
                const validEmail = emails.length > 0;
                if (!validEmail) {
                    body.note = `You are getting this email because the contact point '${dcatDatasetStrings.contactPoint}' on the dataset and ‘${datasetPublisherEmail}’ on the organisation are not valid email addresses`;
                }
                const recipient = validEmail
                    ? emails[0]
                    : options.defaultRecipient;
                const subject = `Question About ${dcatDatasetStrings.title}`;
                const html = renderTemplate_1.default(options.templateRender, renderTemplate_1.Templates.Question, body, subject, options.externalUrl, dataset);
                return html.then(({ renderedContent, attachments }) => {
                    return mail_1.sendMail(options.smtpMailer, options.defaultRecipient, body, renderedContent, attachments, subject, recipient, options.alwaysSendToDefaultRecipient);
                });
            });
            handlePromise(promise, res, req.params.datasetId);
        });
    });
    /**
     * Gets a dataset from the registry as a promise, unwrapping it from its
     * aspect.
     */
    function getDataset(datasetId) {
        return options.registry
            .getRecord(encodeURIComponent(datasetId), ["dcat-dataset-strings"], ["dataset-publisher"], true)
            .then(result => unionToThrowable_1.default(result));
    }
    return router;
}
exports.default = createApiRouter;
/**
 * Translates a promise into a response, returning 200 if the promise resolves,
 * 404 if it rejects with `response.statusCode: 404` in the error (as per the
 * registry api) or 500 if it rejects for another reason.
 */
function handlePromise(promise, response, datasetId) {
    promise
        .then(() => response.status(200).json({ status: "OK" }))
        .catch(e => {
        if (lodash_1.default.get(e, "e.response.statusCode") === 404) {
            console.error("Attempted to send correspondence for non-existent dataset " +
                datasetId);
            response.status(404).json({
                status: "Failure",
                error: "Dataset " + datasetId + " not found"
            });
        }
        else {
            throw e;
        }
    })
        .catch(e => {
        console.error(e);
        response.status(500).json({ status: "Failure" });
    });
}
//# sourceMappingURL=createApiRouter.js.map