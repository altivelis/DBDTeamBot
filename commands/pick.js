const {SlashCommandBuilder, EmbedBuilder}=require('discord.js');
const wait = require('node:timers/promises').setTimeout;

module.exports = {
	data: new SlashCommandBuilder()
		.setName('pick')
		.setDescription('メンバー抽選')
        .addIntegerOption(option=>
            option
                .setName("team")
                .setDescription("チームから抽選(省略可)")
                .setRequired(false)
        ),
	async execute(interaction) {
        if(interaction.channel.status!=1){
            await interaction.reply("チーム分けが開始されていません");
            await wait(2000);
            await interaction.deleteReply();
            return;
        }
        let num = interaction.options.getInteger("team");
        let T = interaction.channel.TEAM;
        
        if(num==null){
            if(T.members.length==0){
                await interaction.reply("メンバーが居ません");
                await wait(2000);
                await interaction.deleteReply();
                return;
            }
            choose = T.members[Math.floor(Math.random()*T.members.length)];
            str="メンバー";
        }else{
            str="チーム"+num;
            if(0<num&&num<=T.num){
                let array = getArray(T.teams,num-1);
                if(array.length==0){
                    await interaction.reply("メンバーが居ません");
                    await wait(2000);
                    await interaction.deleteReply();
                    return;
                }
                choose = array[Math.floor(Math.random()*array.length)];
            }
        }
        interaction.reply(`pick[${str}] => ${choose.toString()}`);
	}
}
function getArray(array,index){
    let tmp = new Array();
    for(let i in array[index]){
        tmp.push(array[index][i]);
    }
    return tmp;
}
