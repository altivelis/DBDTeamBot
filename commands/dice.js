const {SlashCommandBuilder}=require('discord.js');

module.exports={
    data: new SlashCommandBuilder()
        .setName("dice")
        .setDescription("ダイスロール(初期値6面)")
        .addIntegerOption(option=>
            option.setName("num")
                .setDescription("個数")
                .setRequired(true))
        .addIntegerOption(option=>
            option.setName("face")
                .setDescription("面"))
        .addBooleanOption(option=>
            option.setName("hide")
                .setDescription("シークレットダイス")),
    async execute(interaction){
        const num = interaction.options.getInteger("num");
        const face = interaction.options.getInteger("face") ?? 6;
        const hide = interaction.options.getBoolean("hide") ?? false;
        let result = new Array(num);
        let sum=0;
        for(let i=0;i<num;i++){
            result[i]=Math.floor(Math.random()*face)+1;
            sum+=result[i];
        }
        await interaction.reply({content:`<${num}D${face}>\n[${result}]=>${sum}`,ephemeral:hide});
    }
}