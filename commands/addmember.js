const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("addmember")
        .setDescription("チーム分けにメンバーを手動追加")
        .addUserOption(option =>
            option.setName('user')
                .setDescription('追加するユーザー')
                .setRequired(true)),
    async execute(interaction) {
        if (interaction.channel.status != 1) {
            await interaction.reply({ content: "チーム分けセッションが開始されていません", ephemeral: true });
            return;
        }

        let sessionData = interaction.channel.TEAM;
        const targetUser = interaction.options.getUser('user');
        const targetMember = interaction.guild.members.cache.get(targetUser.id);
        
        // BOTユーザーや観戦者は追加できない
        if (targetUser.bot) {
            await interaction.reply({ content: "BOTユーザーは追加できません", ephemeral: true });
            return;
        }
        
        if (targetMember.displayName.startsWith('観戦')) {
            await interaction.reply({ content: "観戦者は追加できません", ephemeral: true });
            return;
        }

        // 既に参加者に含まれているかチェック
        const memberExists = sessionData.members.find(member => member.id === targetUser.id);
        if (memberExists) {
            await interaction.reply({ content: "このユーザーは既に参加者に含まれています", ephemeral: true });
            return;
        }

        // メンバーを追加
        sessionData.members.push(targetMember);

        // モードに応じてチーム構成を再計算
        if (sessionData.mode === 'tag') {
            // 1対4の組み合わせを複数作る
            const groupCount = Math.floor(sessionData.members.length / 5);
            // 既存のチーム分けを保持しつつ、必要に応じて新しいグループを追加
            if (groupCount > sessionData.teams.length) {
                const newGroupCount = groupCount - sessionData.teams.length;
                for (let i = 0; i < newGroupCount; i++) {
                    sessionData.teams.push({ oni: null, runners: [] });
                }
            }
            sessionData.groupCount = groupCount;
        } else if (sessionData.mode === 'equal') {
            // 均等分割の場合、必要なチーム数を再計算
            const teamCount = Math.ceil(sessionData.members.length / sessionData.teamSize);
            // 既存のチーム分けを保持しつつ、必要に応じて新しいチームを追加
            if (teamCount > sessionData.teams.length) {
                const newTeamCount = teamCount - sessionData.teams.length;
                for (let i = 0; i < newTeamCount; i++) {
                    sessionData.teams.push([]);
                }
            }
        }

        // Embedを更新
        let embed = createEmbed(sessionData);
        await sessionData.msg.edit({ embeds: [embed] });

        const replyMsg = await interaction.reply({ content: `${targetMember.nickname}をチーム分けに追加しました！（現在${sessionData.members.length}人）` });
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
