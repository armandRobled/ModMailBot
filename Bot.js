const Discord = require(`discord.js`);

class Bot {
  /**
   * Initializes a Discord client, binds events.
   * @constructor
   */
  constructor() {
    this.client = new Discord.Client({ intents: [ 
      Discord.Intents.FLAGS.GUILDS,
      Discord.Intents.FLAGS.GUILD_MESSAGES
    ]});
    this.bindEvents();
  }
  
  /**
   * Bind event functions.
   */
  bindEvents() {
    this.client.on(`ready`, this.onReady.bind(this));
    this.client.on(`interactionCreate`, this.onInteractionCreate.bind(this));
  }

  /**
   * Login client to Discord.
   */
  connect() {
    this.client.login(process.env.AUTH_TOKEN);
  }

  /**
   * Destroy Discord client.
   */
  destroy() {
    console.log('Shutting down.');
    this.client.destroy();
  }

  /**
   * Bot is connected to Discord.
   */
  onReady() {
    console.log(`Connected to Discord as ${this.client.user.username}#${this.client.user.discriminator} <@${this.client.user.id}>`);

    this.setCommands();
  }

  onInteractionCreate(Interaction) {
    // Handle commands
    if (Interaction.isCommand()) {
      if (Interaction.commandName === `generate`) {
        this.generateModMailMessage(Interaction, Interaction.channel);
        return;
      }
    }

    // Handle buttons
    if (Interaction.isButton()) {
      if (Interaction.customId === `createModMail`) {
        this.createNewThread(Interaction);
      }
    }
  }

  /**
   * Add the `/generate` command to the guild
   */
  async setCommands() {
    const guild = await this.client.guilds.cache.first();

    const staffRole = await guild.roles.cache.find(role => role.name === process.env.STAFF_ROLE_NAME);

    guild.commands.set([{
      name: `generate`,
      description: `Generate modmail message with contact button in channel where command is run`,
      defaultPermission: false
    }]).then(commands => {
      commands.forEach(command => {
        const permissions = [{
          id: staffRole.id,
          type: `ROLE`,
          permission: true
        }];

        command.permissions.set({ permissions });
      })
    })
  }

  /**
   * Generates the message with the "Contact Staff" button inside the channel where this command is run.
   * @param {Interaction} Interaction 
   * @param {Channel} Channel 
   */
  async generateModMailMessage(Interaction, Channel) {
    const actions = new Discord.MessageActionRow();
    actions.addComponents(
      new Discord.MessageButton()
      .setCustomId(`createModMail`)
      .setLabel(`Contact Staff`)
      .setEmoji(`💌`)
      .setStyle(`PRIMARY`)
    )

    const content = `Have a question, problem, or need help with something? Click the button below and our modmail bot will open a private thread between you and the staff team where you can discuss your issue. Please try to include as much information as possible in your first message so we can help you as quickly as we can.`;

    Channel.send({ content: content, components: [actions] });

    Interaction.reply({ content: `Done!` });
    const response = await Interaction.fetchReply();
    response.delete();
  }

  /**
   * Handles creating the private thread when the "Contact Staff" button is pressed
   * @param {Interaction} Interaction 
   */
  async createNewThread(Interaction) {
    Interaction.reply({ content: `Creating your thread...`, ephemeral: true });

    const staffRole = await Interaction.guild.roles.cache.find(role => role.name === process.env.STAFF_ROLE_NAME);

    // Create the private thread, invite the user. Auto archives after 24h.
    const thread = await Interaction.channel.threads.create({
      name: `${Interaction.user.username}#${Interaction.user.discriminator}`,
      autoArchiveDuration: 1440,
      type: `private_thread`,
      reason: `${Interaction.user.username}#${Interaction.user.discriminator} wants to contact staff.`
    })

    await thread.setLocked(true);
    await thread.members.add(Interaction.member);
    
    // Send a message in the new thread to notify the user and give instructions.
    const infoMessage = await thread.send({ content: `Hello! Please write your message inside this private thread. Include as much information as you can. Staff will be notified after you send your first message.`})

    // Edit original interaction response with a link to the new thread
    Interaction.editReply({ content: `Here is your thread with the staff team: ${thread.lastMessage.url}` });
    
    const filter = Message => Message.member === Interaction.member;

    // Message collector that listens for the user's first message, then contacts the staff role.
    thread.awaitMessages({ filter, max: 1 }).then(Message => {
      infoMessage.delete();
      thread.send({ content: `${staffRole.toString()} ${Interaction.member.toString()} wants to contact staff.` });
    });
  }
}

module.exports = Bot;
