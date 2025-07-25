const {SlashCommandBuilder}=require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ccb')
		.setDescription('クトゥルフTRPG技能ロール')
        .addIntegerOption(option=>
            option.setName("value")
                .setDescription("技能値")
                .setRequired(true))
        .addStringOption(option=>
            option.setName("name")
                .setDescription("技能名"))
        .addBooleanOption(option=>
            option.setName("hide")
                .setDescription("シークレットダイス")),
	async execute(interaction) {
        const value = interaction.options.getInteger("value");
        const name = interaction.options.getString("name")??null;
        const hide = interaction.options.getBoolean("hide")??false;
        let dice = Math.floor(Math.random()*100)+1;
        await interaction.reply({content:`${(name)?"["+name+"]":""}${dice}<=${value} ${(dice<=value)?(dice<=5)?"クリティカル(決定的成功)":"成功":(dice<96)?"失敗":"ファンブル(致命的失敗)"}`,
                ephemeral:hide});
	}
}