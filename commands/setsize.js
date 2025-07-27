const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("setsize")
        .setDescription("1チームあたりの人数を設定（均等分割モード専用）")
        .addIntegerOption(option =>
            option.setName('size')
                .setDescription('1チームあたりの人数（1-10）')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(10)),
    async execute(interaction) {
        if (interaction.channel.status != 1) {
            await interaction.reply({ content: "チーム分けセッションが開始されていません", ephemeral: true });
            return;
        }

        let sessionData = interaction.channel.TEAM;
        
        if (sessionData.mode !== 'equal') {
            await interaction.reply({ content: "このコマンドは均等分割モードでのみ使用できます", ephemeral: true });
            return;
        }

        const newSize = interaction.options.getInteger('size');
        
        // チームサイズを更新
        sessionData.teamSize = newSize;
        
        // 新しいサイズに基づいてチーム配列を再構築
        const teamCount = Math.ceil(sessionData.members.length / newSize);
        sessionData.teams = new Array(teamCount).fill().map(() => []);

        // Embedを更新
        let embed = createEmbed(sessionData);
        await sessionData.msg.edit({ embeds: [embed] });

        const replyMsg = await interaction.reply({ content: `1チームあたりの人数を${newSize}人に設定しました！\n必要チーム数: ${teamCount}チーム` });
        setTimeout(() => {
            interaction.deleteReply();
        }, 5000);
    }
}

function createEmbed(sessionData) {
    let embed = new EmbedBuilder()
        .setColor(0x0099FF);

    if (sessionData.mode === 'tag') {
        embed.setTitle("🏃‍♂️ 鬼ごっこチーム分け");
        
        if (sessionData.members.length > 0) {
            embed.addFields({ name: "👥 参加者", value: createMembersList(sessionData.members) });
        } else {
            embed.addFields({ name: "👥 参加者", value: "参加者がいません" });
        }

        if (sessionData.oni) {
            embed.addFields({ name: "👹 鬼", value: sessionData.oni.toString(), inline: true });
        } else {
            embed.addFields({ name: "👹 鬼", value: "未設定", inline: true });
        }

        if (sessionData.teams[1] && sessionData.teams[1].length > 0) {
            embed.addFields({ name: "🏃 逃げる人", value: createMembersList(sessionData.teams[1]), inline: true });
        } else {
            embed.addFields({ name: "🏃 逃げる人", value: "未設定", inline: true });
        }

    } else if (sessionData.mode === 'equal') {
        embed.setTitle("⚖️ 均等チーム分け");
        
        if (sessionData.members.length > 0) {
            embed.addFields({ name: "👥 参加者", value: createMembersList(sessionData.members) });
        } else {
            embed.addFields({ name: "👥 参加者", value: "参加者がいません" });
        }

        embed.addFields({ name: "📊 設定", value: `1チーム ${sessionData.teamSize}人` });

        // チーム表示
        for (let i = 0; i < sessionData.teams.length; i++) {
            const teamEmojis = ['🔵', '🔴', '🟡', '🟢', '🟣', '🟠'];
            const emoji = teamEmojis[i] || '⭐';
            
            if (sessionData.teams[i].length > 0) {
                embed.addFields({ 
                    name: `${emoji} チーム${i + 1}`, 
                    value: createMembersList(sessionData.teams[i]), 
                    inline: true 
                });
            } else {
                embed.addFields({ 
                    name: `${emoji} チーム${i + 1}`, 
                    value: "未設定", 
                    inline: true 
                });
            }
        }
    }

    return embed;
}

function createMembersList(members) {
    if (!members || members.length === 0) return "なし";
    return members.map(member => member.toString()).join('\n');
}
