// Demo source file. slopguard also walks imports/requires, not just manifests.
import express from "express";
import { z } from "zod";
import { hallucinatedHelper } from "react-codeshift";
import fastVector from "ai-vector-toolkit-fast";
import fs from "node:fs"; // builtin — ignored
import { join } from "path"; // builtin — ignored

const app = express();
void z;
void hallucinatedHelper;
void fastVector;
void fs;
void join;

app.listen(3000);
