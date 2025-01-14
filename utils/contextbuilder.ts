import { Encoder } from "nai-js-tokenizer";
let tokenizerData = require("../tokenizers/nerdstash_tokenizer_v2.json");

interface Tks {
	[key: string]: number;
}
const tks: Tks = {
	opus: 8192,

	scroll: 8192,

	tablet: 4096,
};
let encoder = new Encoder(
	tokenizerData.vocab,
	tokenizerData.merges,
	tokenizerData.specialTokens,
	tokenizerData.config
);
interface ATTG {
	author: string;
	genre: string;
	tags: string;
	title: string;
}

export default function ContextBuilder(
	text: string,
	attg: ATTG,
	memory: string,
	prefix: string,
	model: string,
	sub: string,
	tokens: number,
	generate_until_sentence: boolean,
	lore: string[]
) {
	const encodeForModel = (text: string): number[] => {
		if (model === "clio-v1") {
			tokenizerData = require("../tokenizers/nerdstash_tokenizer.json");
			encoder = new Encoder(
				tokenizerData.vocab,
				tokenizerData.merges,
				tokenizerData.specialTokens,
				tokenizerData.config
			);
		} else if (model === "llama-3-erato-v1") {
			tokenizerData = require("../tokenizers/llama3nai_tokenizer.json");
			encoder = new Encoder(
				tokenizerData.vocab,
				tokenizerData.merges,
				tokenizerData.specialTokens,
				tokenizerData.config
			);
		}
		return encoder.encode(text);
	};

	const prefixTokens = prefix !== "" ? 40 : 0;
	const generatedTokens = generate_until_sentence ? 20 : 0;
	const memoryTokens = memory !== "" ? encodeForModel(memory + "\n") : [];
	const memoryLength = memoryTokens.length;

	// Build ATTG
	let attgString = "[ ";
	if (attg.author !== "") {
		attgString += "Author: " + attg.author + "; ";
	}
	attgString += "Title: " + attg.title + "; ";
	if (attg.tags !== "") {
		attgString += "Tags: " + attg.tags + "; ";
	}
	if (attg.genre !== "") {
		attgString += "Genre: " + attg.genre + "; ";
	}
	attgString = attgString.slice(0, -2);
	attgString += " ]\n";

	const attgTokens = encodeForModel(attgString);
	const attgTokensLength = attgTokens.length;
	const defaultTokens: number = tks[sub];

	let loreContext = "";
	let loreSize = 0;
	lore.forEach((l) => {
		const encodedLoreSize = encodeForModel(l + "\n").length;
		if (loreSize + encodedLoreSize < defaultTokens - 1000) {
			loreContext += l + "\n";
			loreSize += encodedLoreSize;
		}
	});
	const loreTokens = encodeForModel(loreContext);

	let maxSize =
		defaultTokens -
		tokens -
		prefixTokens -
		generatedTokens -
		memoryLength -
		attgTokensLength -
		loreTokens.length;

	const encoded = encodeForModel(cleanMarkdown(text));
	const reversedContext = encoded.reverse();
	const turnedAroundContext = reversedContext.slice(0, maxSize);
	const context = turnedAroundContext.reverse();

	const CONTEXT_FULL_THRESHOLD = 500; // Define what "nearly full" means. I will when I find out. O.O
	let finalContext = [
		...attgTokens,
		...memoryTokens,
		...loreTokens,
		...context,
	];
	if (model === "llama-3-erato-v1") {
		if (finalContext.length >= defaultTokens - CONTEXT_FULL_THRESHOLD) {
			if (finalContext.length === defaultTokens) {
				finalContext[0] = 128000;
			} else {
				finalContext.unshift(128000);
			}
		} else {
			finalContext.unshift(128081);
		}
	}
	console.log(finalContext.length);
	console.log("True Context: " + encoder.decode(finalContext));
	console.log(finalContext);
	return finalContext;
}
function cleanMarkdown(text: string) {
	console.log("Before: " + text);
	// remove '#tags-tags'
	text = text.replace(/#[a-zA-Z0-9]+-[a-zA-Z0-9]+/g, "");
	// remove '#tags_tags'
	text = text.replace(/#[a-zA-Z0-9]+_[a-zA-Z0-9]+/g, "");
	// remove '#tags'
	text = text.replace(/#[a-zA-Z0-9]+/g, "");

	let lastNewLine = false;
	// check if there is a new line at the end of the text
	text[text.length - 1] === "\n" ? (lastNewLine = true) : null;

	// remove references and images: ![[]]
	text = text.replace(/\!\[\[.*?\]\]/g, "");
	// get rid of [[]]
	text = text.replace("[[", "");
	text = text.replace("]]", "");

	// remove markdown
	// to be added

	// remove newlines
	while (text.includes("\n\n")) {
		text = text.replace("\n\n", "\n");
	}
	while (text.includes("  ")) {
		text = text.replace("  ", " ");
	}
	text.replace("\n ", "\n");
	text.replace(" \n", "\n");
	text = text.trim();
	// add last newline
	lastNewLine ? (text += "\n") : null;
	console.log("After: " + text);
	return text;
}
