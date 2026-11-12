// Validates public/admin/config.yml against the Sveltia CMS JSON schema (schema.json).
import fs from "node:fs";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import yaml from "yaml";

const schema = JSON.parse(fs.readFileSync("schema.json", "utf8"));
const data = yaml.parse(fs.readFileSync("public/admin/config.yml", "utf8"));

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);

if (validate(data)) {
	console.log("YAML is valid!");
} else {
	console.error(validate.errors);
	process.exit(1);
}
