import {
	Client,
	GatewayIntentBits,
	Events,
	EmbedBuilder,
	ApplicationCommandOptionType,
	REST,
	Routes,
	SlashCommandBuilder,
} from "discord.js"
import dotenv from "dotenv"
import { PrismaClient } from "@prisma/client"

dotenv.config()

const prisma = new PrismaClient()

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	],
})

// Command definitions
const commands = [
	new SlashCommandBuilder()
		.setName("role")
		.setDescription("Manage roles for a user")
		.addSubcommand((subcommand) =>
			subcommand
				.setName("add")
				.setDescription("Add a role to a user")
				.addUserOption((option) =>
					option
						.setName("user")
						.setDescription("The user to add the role to")
						.setRequired(true)
				)
				.addRoleOption((option) =>
					option
						.setName("role")
						.setDescription("The role to add")
						.setRequired(true)
				)
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("remove")
				.setDescription("Remove a role from a user")
				.addUserOption((option) =>
					option
						.setName("user")
						.setDescription("The user to remove the role from")
						.setRequired(true)
				)
				.addRoleOption((option) =>
					option
						.setName("role")
						.setDescription("The role to remove")
						.setRequired(true)
				)
		),
	new SlashCommandBuilder()
		.setName("roll")
		.setDescription("Roll a dice")
		.addIntegerOption((option) =>
			option
				.setName("sides")
				.setDescription("Number of sides on the dice (default: 6)")
				.setMinValue(2)
				.setMaxValue(100)
		),
	new SlashCommandBuilder().setName("flip").setDescription("Flip a coin"),
	new SlashCommandBuilder()
		.setName("serverinfo")
		.setDescription("Display information about the server"),
	new SlashCommandBuilder()
		.setName("userinfo")
		.setDescription("Display information about a user")
		.addUserOption((option) =>
			option
				.setName("user")
				.setDescription("The user to get information about")
				.setRequired(false)
		),
	new SlashCommandBuilder()
		.setName("help")
		.setDescription("Show available commands"),
	new SlashCommandBuilder()
		.setName("poll")
		.setDescription("Create a simple poll")
		.addStringOption((option) =>
			option
				.setName("question")
				.setDescription("The poll question")
				.setRequired(true)
		)
		.addStringOption((option) =>
			option
				.setName("options")
				.setDescription("Poll options (comma-separated)")
				.setRequired(true)
		),
].map((command) => command.toJSON())

// Register commands
const rest = new REST().setToken(process.env.DISCORD_TOKEN!)

client.once(Events.ClientReady, async (readyClient) => {
	console.log(`Ready! Logged in as ${readyClient.user.tag}`)

	try {
		console.log("Started refreshing application (/) commands.")
		await rest.put(Routes.applicationCommands(readyClient.user.id), {
			body: commands,
		})
		console.log("Successfully reloaded application (/) commands.")
	} catch (error) {
		console.error(error)
	}
})

client.on(Events.GuildMemberAdd, async (member) => {
	// Get the welcome channel (you can make this configurable later)
	const welcomeChannel = member.guild.systemChannel

	if (!welcomeChannel) return

	// Create welcome embed
	const welcomeEmbed = new EmbedBuilder()
		.setColor("#00ff00")
		.setTitle("Welcome to the Server! 🎉")
		.setDescription(`Welcome ${member}! We're glad to have you here!`)
		.setThumbnail(member.user.displayAvatarURL({ size: 256 }))
		.addFields(
			{ name: "Username", value: member.user.username, inline: true },
			{
				name: "Account Created",
				value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
				inline: true,
			},
			{
				name: "Member Count",
				value: `${member.guild.memberCount}`,
				inline: true,
			}
		)
		.setFooter({ text: `ID: ${member.user.id}` })
		.setTimestamp()

	// If the member has roles, add them to the embed
	if (member.roles.cache.size > 1) {
		// > 1 because @everyone is always present
		const roles = member.roles.cache
			.filter((role) => role.id !== member.guild.id) // Filter out @everyone
			.map((role) => role.toString())
			.join(", ")

		welcomeEmbed.addFields({
			name: "Roles",
			value: roles || "No roles assigned",
		})
	}

	await welcomeChannel.send({ embeds: [welcomeEmbed] })
})

// Command handler
client.on(Events.InteractionCreate, async (interaction) => {
	if (!interaction.isChatInputCommand()) return

	const { commandName } = interaction

	switch (commandName) {
		case "role": {
			const subcommand = interaction.options.getSubcommand()
			const user = interaction.options.getUser("user", true)
			const role = interaction.options.getRole("role", true)
			const member = await interaction.guild?.members.fetch(user.id)

			if (!member) {
				await interaction.reply({
					content: "Could not find that user in this server.",
					ephemeral: true,
				})
				return
			}

			try {
				if (subcommand === "add") {
					await member.roles.add(role.id)
					await interaction.reply(`Added role ${role} to ${user}`)
				} else if (subcommand === "remove") {
					await member.roles.remove(role.id)
					await interaction.reply(`Removed role ${role} from ${user}`)
				}
			} catch (error) {
				console.error(error)
				await interaction.reply({
					content: "Failed to manage role. Check bot permissions.",
					ephemeral: true,
				})
			}
			break
		}

		case "roll": {
			const sides = interaction.options.getInteger("sides") || 6
			const result = Math.floor(Math.random() * sides) + 1
			await interaction.reply(`🎲 You rolled a **${result}** (1-${sides})`)
			break
		}

		case "flip": {
			const result = Math.random() < 0.5 ? "Heads" : "Tails"
			await interaction.reply(`🪙 The coin landed on **${result}**`)
			break
		}

		case "serverinfo": {
			const guild = interaction.guild
			if (!guild) {
				await interaction.reply({
					content: "This command can only be used in a server.",
					ephemeral: true,
				})
				return
			}

			const serverEmbed = new EmbedBuilder()
				.setColor("#0099ff")
				.setTitle(`${guild.name} Server Information`)
				.setThumbnail(guild.iconURL({ size: 256 }))
				.addFields(
					{ name: "Server ID", value: guild.id, inline: true },
					{ name: "Owner", value: `<@${guild.ownerId}>`, inline: true },
					{
						name: "Created On",
						value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`,
						inline: true,
					},
					{ name: "Members", value: `${guild.memberCount}`, inline: true },
					{
						name: "Channels",
						value: `${guild.channels.cache.size}`,
						inline: true,
					},
					{ name: "Roles", value: `${guild.roles.cache.size}`, inline: true },
					{
						name: "Boost Level",
						value: `Level ${guild.premiumTier}`,
						inline: true,
					},
					{
						name: "Verification Level",
						value: guild.verificationLevel.toString(),
						inline: true,
					},
					{
						name: "Region",
						value: guild.preferredLocale || "Not set",
						inline: true,
					}
				)
				.setFooter({ text: `Requested by ${interaction.user.tag}` })
				.setTimestamp()

			await interaction.reply({ embeds: [serverEmbed] })
			break
		}

		case "userinfo": {
			const targetUser = interaction.options.getUser("user") || interaction.user
			const member = await interaction.guild?.members.fetch(targetUser.id)

			if (!member) {
				await interaction.reply({
					content: "Could not find that user in this server.",
					ephemeral: true,
				})
				return
			}

			const userEmbed = new EmbedBuilder()
				.setColor("#0099ff")
				.setTitle(`User Information: ${targetUser.username}`)
				.setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
				.addFields(
					{ name: "User ID", value: targetUser.id, inline: true },
					{ name: "Username", value: targetUser.username, inline: true },
					{
						name: "Discriminator",
						value: targetUser.discriminator,
						inline: true,
					},
					{
						name: "Account Created",
						value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:F>`,
						inline: true,
					},
					{
						name: "Joined Server",
						value: `<t:${Math.floor(member.joinedTimestamp! / 1000)}:F>`,
						inline: true,
					},
					{ name: "Nickname", value: member.nickname || "None", inline: true }
				)
				.setFooter({ text: `Requested by ${interaction.user.tag}` })
				.setTimestamp()

			// Add roles if the user has any
			if (member.roles.cache.size > 1) {
				const roles = member.roles.cache
					.filter((role) => role.id !== interaction.guild!.id)
					.map((role) => role.toString())
					.join(", ")

				userEmbed.addFields({
					name: "Roles",
					value: roles || "No roles assigned",
				})
			}

			await interaction.reply({ embeds: [userEmbed] })
			break
		}

		case "help": {
			const helpEmbed = new EmbedBuilder()
				.setColor("#0099ff")
				.setTitle("Bot Commands")
				.setDescription("Here are all the available commands:")
				.addFields(
					{
						name: "Role Management",
						value:
							"`/role add` - Add a role to a user\n`/role remove` - Remove a role from a user",
						inline: false,
					},
					{
						name: "Fun Commands",
						value: "`/roll` - Roll a dice\n`/flip` - Flip a coin",
						inline: false,
					},
					{
						name: "Information",
						value:
							"`/serverinfo` - Display server information\n`/userinfo` - Display user information",
						inline: false,
					},
					{
						name: "Utility",
						value:
							"`/help` - Show this help message\n`/poll` - Create a simple poll",
						inline: false,
					}
				)
				.setFooter({ text: "Use / to see detailed command information" })
				.setTimestamp()

			await interaction.reply({ embeds: [helpEmbed] })
			break
		}

		case "poll": {
			const question = interaction.options.getString("question", true)
			const optionsString = interaction.options.getString("options", true)
			const options = optionsString.split(",").map((option) => option.trim())

			if (options.length < 2 || options.length > 10) {
				await interaction.reply({
					content: "Please provide between 2 and 10 options for the poll.",
					ephemeral: true,
				})
				return
			}

			const emojis = [
				"1️⃣",
				"2️⃣",
				"3️⃣",
				"4️⃣",
				"5️⃣",
				"6️⃣",
				"7️⃣",
				"8️⃣",
				"9️⃣",
				"🔟",
			]
			let pollDescription = ""

			for (let i = 0; i < options.length; i++) {
				pollDescription += `${emojis[i]} ${options[i]}\n`
			}

			const pollEmbed = new EmbedBuilder()
				.setColor("#0099ff")
				.setTitle(`📊 ${question}`)
				.setDescription(pollDescription)
				.setFooter({ text: `Poll created by ${interaction.user.tag}` })
				.setTimestamp()

			const pollMessage = await interaction.reply({
				embeds: [pollEmbed],
				fetchReply: true,
			})

			// Add reactions for each option
			for (let i = 0; i < options.length; i++) {
				await pollMessage.react(emojis[i])
			}
			break
		}
	}
})

// Error handling
client.on(Events.Error, (error) => {
	console.error("Discord client error:", error)
})

// Graceful shutdown
process.on("SIGINT", async () => {
	await prisma.$disconnect()
	client.destroy()
	process.exit(0)
})

client.login(process.env.DISCORD_TOKEN)
