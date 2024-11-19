const { Client, GatewayIntentBits, Events } = require("discord.js");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const stringSimilarity = require("string-similarity");

dotenv.config();

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	],
});

// Load GIFs from JSON file
const gifsPath = path.join(__dirname, "gifs.json");
let gifsData = {};

function loadGifs() {
	try {
		gifsData = JSON.parse(fs.readFileSync(gifsPath, "utf8"));
	} catch (error) {
		console.error("Error loading GIF data:", error);
		gifsData = {};
	}
}

function findBestGifMatch(searchKey) {
	const gifKeys = Object.keys(gifsData);

	// Exact match first
	if (gifsData[searchKey]) {
		return gifsData[searchKey].url;
	}

	// Fuzzy match using string similarity
	const matches = stringSimilarity.findBestMatch(searchKey, gifKeys);
	const bestMatch = matches.bestMatch;

	// If similarity is above 0.5, return the matched GIF
	if (bestMatch.rating > 0.5) {
		return gifsData[bestMatch.target].url;
	}

	return null;
}

// Initial load and set up file watcher
loadGifs();
fs.watch(gifsPath, (eventType) => {
	if (eventType === "change") {
		loadGifs();
	}
});

client.once(Events.ClientReady, (readyClient) => {
	console.log(`Logged in as ${readyClient.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
	console.log(
		`Received message from ${message.author.tag}: ${message.content}`,
	);
	if (message.author.bot) return;

	const gifMatch = message.content.match(/^!(\w+(-\w+)*)$/);

	if (gifMatch) {
		const gifId = gifMatch[1];
		const gifUrl = findBestGifMatch(gifId);

		if (gifUrl) {
			await message.delete();

			if (message.reference) {
				// If it's a reply, send GIF as a reply to the referenced message
				const referencedMessage = await message.fetchReference();
				await referencedMessage.reply(gifUrl);
			} else {
				// If not a reply, send GIF in the same channel
				await message.channel.send(gifUrl);
			}
		} else {
			message.reply("GIF not found!");
		}
	}
});

// Error handling
client.on(Events.Error, console.error);
process.on("unhandledRejection", console.error);

client.login(process.env.DISCORD_TOKEN);
