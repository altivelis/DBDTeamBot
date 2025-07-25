const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('teamend')
        .setDescription('チーム分けセッションを終了'),
    async execute(interaction) {
        if (interaction.channel.status != 1) {
            await interaction.reply({ content: "チーム分けセッションが開始されていません", ephemeral: true });
            return;
        }

        // セッションデータをクリア
        interaction.channel.status = 0;
        interaction.channel.TEAM = null;

        await interaction.reply("✅ チーム分けセッションを終了しました");
    }
}
