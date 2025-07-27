const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("randomoni")
        .setDescription("全グループにランダムに鬼を配置（鬼ごっこモード専用）"),
    async execute(interaction) {
        if (interaction.channel.status != 1) {
            await interaction.reply({ content: "チーム分けセッションが開始されていません", ephemeral: true });
            return;
        }

        let sessionData = interaction.channel.TEAM;
        
        if (sessionData.mode !== 'tag') {
            await interaction.reply({ content: "このコマンドは鬼ごっこモードでのみ使用できます", ephemeral: true });
            return;
        }

        if (sessionData.members.length < 5) {
            await interaction.reply({ content: "最低5人必要です（1グループあたり5人）", ephemeral: true });
            return;
        }

        // 鬼候補者リストが存在しない場合は初期化
        if (!sessionData.oniCandidates) {
            sessionData.oniCandidates = [];
        }

        const requiredOniCount = sessionData.teams.length; // 必要な鬼の数
        const candidateCount = sessionData.oniCandidates.length;

        let selectedOnis = [];
        let remainingMembers = [...sessionData.members];

        if (candidateCount < requiredOniCount) {
            // 鬼候補者 < 必要な鬼の数: 鬼候補者全員を鬼に、不足分は残りからランダム選択
            selectedOnis = [...sessionData.oniCandidates];
            
            // 鬼候補者を残りメンバーから除外
            remainingMembers = sessionData.members.filter(member => 
                !sessionData.oniCandidates.some(candidate => candidate.id === member.id)
            );
            
            // 不足分をランダム選択
            const shortage = requiredOniCount - candidateCount;
            for (let i = 0; i < shortage; i++) {
                if (remainingMembers.length > 0) {
                    const randomIndex = Math.floor(Math.random() * remainingMembers.length);
                    selectedOnis.push(remainingMembers.splice(randomIndex, 1)[0]);
                }
            }
        } else if (candidateCount === requiredOniCount) {
            // 鬼候補者 = 必要な鬼の数: 鬼候補者全員を鬼に
            selectedOnis = [...sessionData.oniCandidates];
            
            // 鬼候補者を残りメンバーから除外
            remainingMembers = sessionData.members.filter(member => 
                !sessionData.oniCandidates.some(candidate => candidate.id === member.id)
            );
        } else {
            // 鬼候補者 > 必要な鬼の数: 鬼候補者からランダム選択
            const shuffledCandidates = [...sessionData.oniCandidates];
            for (let i = shuffledCandidates.length - 1; i >= 0; i--) {
                const rand = Math.floor(Math.random() * (i + 1));
                [shuffledCandidates[i], shuffledCandidates[rand]] = [shuffledCandidates[rand], shuffledCandidates[i]];
            }
            
            selectedOnis = shuffledCandidates.slice(0, requiredOniCount);
            
            // 選ばれなかった鬼候補者も残りメンバーに含める
            const unselectedCandidates = shuffledCandidates.slice(requiredOniCount);
            remainingMembers = sessionData.members.filter(member => 
                !selectedOnis.some(oni => oni.id === member.id)
            );
        }

        // 残りメンバーをシャッフル
        for (let i = remainingMembers.length - 1; i >= 0; i--) {
            const rand = Math.floor(Math.random() * (i + 1));
            [remainingMembers[i], remainingMembers[rand]] = [remainingMembers[rand], remainingMembers[i]];
        }

        // 各グループに鬼と逃げる人を配置
        let runnerIndex = 0;
        for (let i = 0; i < sessionData.teams.length; i++) {
            // 鬼を設定
            sessionData.teams[i].oni = selectedOnis[i];
            
            // 逃げる人を設定
            sessionData.teams[i].runners = [];
            for (let j = 0; j < 4 && runnerIndex < remainingMembers.length; j++) {
                sessionData.teams[i].runners.push(remainingMembers[runnerIndex]);
                runnerIndex++;
            }
        }

        // Embedを更新
        let embed = createEmbed(sessionData);
        await sessionData.msg.edit({ embeds: [embed] });

        let resultMessage = `🎲 ${sessionData.teams.length}グループに鬼を配置しました！\n`;
        if (candidateCount < requiredOniCount) {
            resultMessage += `鬼候補者${candidateCount}人 + ランダム${requiredOniCount - candidateCount}人`;
        } else if (candidateCount === requiredOniCount) {
            resultMessage += `鬼候補者全員（${candidateCount}人）`;
        } else {
            resultMessage += `鬼候補者${candidateCount}人からランダム${requiredOniCount}人選択`;
        }

        const replyMsg = await interaction.reply({ content: resultMessage });
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
