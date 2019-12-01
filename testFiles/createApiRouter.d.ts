import express from "express";
import RegistryClient from "@magda/typescript-common/dist/registry/RegistryClient";
import { SMTPMailer } from "./SMTPMailer";
import EmailTemplateRender from "./EmailTemplateRender";
/// <reference types="@magda/typescript-common/dist/test" />
export interface ApiRouterOptions {
  registry: RegistryClient;
  templateRender: EmailTemplateRender;
  defaultRecipient: string;
  smtpMailer: SMTPMailer;
  externalUrl: string;
  alwaysSendToDefaultRecipient: boolean;}

export default function createApiRouter(options: ApiRouterOptions): express.Router;