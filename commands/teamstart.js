const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("teamstart")
        .setDescription("チーム分けセッションを開始")
        .addStringOption(option =>
            option.setName('mode')
                .setDescription('チーム分けモード')
                .setRequired(false)
                .addChoices(
                    { name: '鬼ごっこ（1vs4）', value: 'tag' },
                    { name: '均等分割', value: 'equal' }
                )),
    async execute(interaction) {
        // 初期設定
        interaction.channel.status = 1;
        let vc = interaction.member.voice.channel;
        let members = [];
        
        if (vc != null) {
            for (let member of vc.members.values()) {
                // フィルタリング: BOTと観戦者を除外
                if (member.user.bot) continue;
                if (member.displayName.startsWith('👀観戦＠')) continue;

                members.push(member);
                console.log(`add from vc=>${member.displayName}`);
            }
        }

        // デフォルトモードは鬼ごっこ
        const mode = interaction.options.getString('mode') || 'tag';
        
        let sessionData = {
            msg: null,
            members: members,
            mode: mode,
            teams: [],
            oni: null,
            teamSize: 4, // 均等分割用のデフォルトサイズ
            oniCandidates: [], // 鬼候補者リスト
            creatorId: interaction.user.id // セッション作成者のID
        };

        // モードに応じて初期チーム構成を設定
        if (mode === 'tag') {
            // 1対4の組み合わせを複数作る
            const groupCount = Math.floor(members.length / 5); // 5人で1グループ（鬼1人+逃げる人4人）
            sessionData.teams = new Array(groupCount).fill().map(() => ({ oni: null, runners: [] }));
            sessionData.groupCount = groupCount;
        } else if (mode === 'equal') {
            // 均等分割の場合、必要なチーム数を計算
            const teamCount = Math.ceil(members.length / sessionData.teamSize);
            sessionData.teams = new Array(teamCount).fill().map(() => []);
        }

        let embed = createEmbed(sessionData);
        let buttons = createButtons(sessionData);
        sessionData.msg = await interaction.channel.send({ embeds: [embed], components: buttons });
        interaction.channel.TEAM = sessionData;

        const modeText = mode === 'tag' ? '鬼ごっこ' : '均等分割';
        const replyMsg = await interaction.reply({ content: `${modeText}モードでチーム分けセッションを開始しました！\nVCメンバー: ${members.length}人` });
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

function createButtons(sessionData) {
    const buttons = [];
    
    // 誰でも使えるボタン（参加者限定）
    const publicRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('candidate_oni')
                .setLabel('🙋‍♂️ 鬼立候補')
                .setStyle(ButtonStyle.Primary)
        );
    buttons.push(publicRow);

    // 作成者限定ボタン
    const creatorRow1 = new ActionRowBuilder();
    
    if (sessionData.mode === 'tag') {
        creatorRow1.addComponents(
            new ButtonBuilder()
                .setCustomId('switch_to_equal')
                .setLabel('⚖️ 均等分割モード')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('clear_oni_candidates')
                .setLabel('🗑️ 鬼候補クリア')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('shuffle_teams')
                .setLabel('🎲 シャッフル')
                .setStyle(ButtonStyle.Success)
        );
    } else {
        creatorRow1.addComponents(
            new ButtonBuilder()
                .setCustomId('switch_to_tag')
                .setLabel('🏃‍♂️ 鬼ごっこモード')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('change_team_size')
                .setLabel('👥 チーム人数変更')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('shuffle_teams')
                .setLabel('🎲 シャッフル')
                .setStyle(ButtonStyle.Success)
        );
    }
    
    buttons.push(creatorRow1);

    return buttons;
}

function createMembersList(members) {
    if (!members || members.length === 0) return "なし";
    return members.map(member => member.toString()).join('\n');
}
