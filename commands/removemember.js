const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("removemember")
        .setDescription("チーム分けからメンバーを削除")
        .addUserOption(option =>
            option.setName('user')
                .setDescription('削除するユーザー')
                .setRequired(true)),
    async execute(interaction) {
        if (interaction.channel.status != 1) {
            await interaction.reply({ content: "チーム分けセッションが開始されていません", ephemeral: true });
            return;
        }

        let sessionData = interaction.channel.TEAM;
        const targetUser = interaction.options.getUser('user');
        const targetMember = interaction.guild.members.cache.get(targetUser.id);
        
        // 参加者に含まれているかチェック
        const memberIndex = sessionData.members.findIndex(member => member.id === targetUser.id);
        if (memberIndex === -1) {
            await interaction.reply({ content: "このユーザーは参加者に含まれていません", ephemeral: true });
            return;
        }

        // メンバーを削除
        sessionData.members.splice(memberIndex, 1);

        // 鬼候補者からも削除（もし含まれていれば）
        if (sessionData.oniCandidates) {
            const candidateIndex = sessionData.oniCandidates.findIndex(member => member.id === targetUser.id);
            if (candidateIndex !== -1) {
                sessionData.oniCandidates.splice(candidateIndex, 1);
            }
        }

        // 既存のチーム分けからも削除
        if (sessionData.mode === 'tag') {
            sessionData.teams.forEach(group => {
                // 鬼から削除
                if (group.oni && group.oni.id === targetUser.id) {
                    group.oni = null;
                }
                // 逃げる人から削除
                if (group.runners) {
                    group.runners = group.runners.filter(runner => runner.id !== targetUser.id);
                }
            });
            
            // グループ数を再計算
            const groupCount = Math.floor(sessionData.members.length / 5);
            sessionData.groupCount = groupCount;
            
            // 余分なグループを削除
            if (groupCount < sessionData.teams.length) {
                sessionData.teams = sessionData.teams.slice(0, groupCount);
            }
        } else if (sessionData.mode === 'equal') {
            sessionData.teams.forEach(team => {
                // チームから削除
                if (Array.isArray(team)) {
                    const memberIndex = team.findIndex(member => member.id === targetUser.id);
                    if (memberIndex !== -1) {
                        team.splice(memberIndex, 1);
                    }
                }
            });
            
            // チーム数を再計算
            const teamCount = Math.ceil(sessionData.members.length / sessionData.teamSize);
            
            // 余分なチームを削除（空のチームがある場合）
            if (teamCount < sessionData.teams.length) {
                sessionData.teams = sessionData.teams.slice(0, teamCount);
            }
        }

        // Embedを更新
        let embed = createEmbed(sessionData);
        await sessionData.msg.edit({ embeds: [embed] });

        const replyMsg = await interaction.reply({ content: `${targetMember.nickname}をチーム分けから削除しました！（現在${sessionData.members.length}人）` });
        setTimeout(() => {
            interaction.deleteReply();
        }, 5000);
    }
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

        // 鬼候補者を表示
        if (sessionData.oniCandidates && sessionData.oniCandidates.length > 0) {
            embed.addFields({ 
                name: "👹 鬼候補者", 
                value: createMembersList(sessionData.oniCandidates) 
            });
        } else {
            embed.addFields({ 
                name: "👹 鬼候補者", 
                value: "未設定" 
            });
        }

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
