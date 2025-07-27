const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shuffle')
        .setDescription('現在のモードでランダムにチーム分けを行う'),
    async execute(interaction) {
        if (interaction.channel.status != 1) {
            await interaction.reply({ content: "チーム分けセッションが開始されていません", ephemeral: true });
            return;
        }

        let sessionData = interaction.channel.TEAM;

        if (sessionData.members.length === 0) {
            await interaction.reply({ content: "参加者がいません", ephemeral: true });
            return;
        }

        if (sessionData.mode === 'tag') {
            // 鬼ごっこモード: 全グループにランダムで鬼と逃げる人を配置
            const shuffledMembers = randomArray(sessionData.members);
            
            // 各グループに鬼1人、逃げる人4人を配置
            let memberIndex = 0;
            for (let i = 0; i < sessionData.teams.length; i++) {
                if (memberIndex + 4 < shuffledMembers.length) {
                    // 鬼を設定
                    sessionData.teams[i].oni = shuffledMembers[memberIndex];
                    memberIndex++;
                    
                    // 逃げる人を設定
                    sessionData.teams[i].runners = [];
                    for (let j = 0; j < 4; j++) {
                        sessionData.teams[i].runners.push(shuffledMembers[memberIndex]);
                        memberIndex++;
                    }
                }
            }

            const replyMsg = await interaction.reply({ content: `🎲 シャッフル完了！${sessionData.teams.length}グループにランダム配置しました！` });
            setTimeout(() => {
                interaction.deleteReply();
            }, 5000);

        } else if (sessionData.mode === 'equal') {
            // 均等分割モード: メンバーをランダムに各チームに配分
            const shuffledMembers = randomArray(sessionData.members);
            
            // チーム配列をリセット
            for (let i = 0; i < sessionData.teams.length; i++) {
                sessionData.teams[i] = [];
            }
            
            // メンバーを順番にチームに配置
            for (let i = 0; i < shuffledMembers.length; i++) {
                const teamIndex = i % sessionData.teams.length;
                sessionData.teams[teamIndex].push(shuffledMembers[i]);
            }

            const replyMsg = await interaction.reply({ content: `🎲 シャッフル完了！${sessionData.teams.length}チームにランダム分割しました！` });
            setTimeout(() => {
                interaction.deleteReply();
            }, 5000);
        }

        // Embedを更新
        let embed = createEmbed(sessionData);
        await sessionData.msg.edit({ embeds: [embed] });
    }
}
function randomArray(array) {
    let result = array.slice(0, array.length);
    for (let i = result.length - 1; i >= 0; i--) {
        let rand = Math.floor(Math.random() * (i + 1));
        [result[i], result[rand]] = [result[rand], result[i]]
    }
    return result;
}

function createEmbed(sessionData) {
    let embed = new EmbedBuilder()
        .setColor(0x0099FF);

    if (sessionData.mode === 'tag') {
        embed.setTitle("🏃‍♂️ 鬼ごっこチーム分け（1vs4複数グループ）");
        
        if (sessionData.members.length > 0) {
            embed.addFields({ name: "👥 参加者", value: createMembersList(sessionData.members) });
        } else {
            embed.addFields({ name: "👥 参加者", value: "参加者がいません" });
        }

        const groupCount = sessionData.groupCount || 0;
        const remainingMembers = sessionData.members.length % 5;
        
        embed.addFields({ 
            name: "📊 設定", 
            value: `${groupCount}グループ作成可能\n余り: ${remainingMembers}人` 
        });

        // 各グループを表示
        for (let i = 0; i < sessionData.teams.length; i++) {
            const group = sessionData.teams[i];
            const groupEmojis = ['🅰️', '🅱️', '🆎', '🅾️', '🔴', '🟡'];
            const emoji = groupEmojis[i] || '⭐';
            
            let groupInfo = '';
            if (group.oni) {
                groupInfo += `👹 鬼: ${group.oni.toString()}\n`;
            } else {
                groupInfo += `👹 鬼: 未設定\n`;
            }
            
            if (group.runners && group.runners.length > 0) {
                groupInfo += `🏃 逃げる人: ${group.runners.map(m => m.toString()).join(', ')}`;
            } else {
                groupInfo += `🏃 逃げる人: 未設定`;
            }
            
            embed.addFields({ 
                name: `${emoji} グループ${i + 1}`, 
                value: groupInfo,
                inline: false
            });
        }

        // 余ったメンバーがいる場合は表示
        if (remainingMembers > 0) {
            const assignedMembers = [];
            sessionData.teams.forEach(group => {
                if (group.oni) assignedMembers.push(group.oni);
                if (group.runners) assignedMembers.push(...group.runners);
            });
            const unassignedMembers = sessionData.members.filter(member => 
                !assignedMembers.some(assigned => assigned.id === member.id)
            );
            
            if (unassignedMembers.length > 0) {
                embed.addFields({ 
                    name: "⚪ 未割り当て", 
                    value: createMembersList(unassignedMembers)
                });
            }
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
