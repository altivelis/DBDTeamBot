const fs = require('node:fs');
const path = require('node:path');
const { Client, GatewayIntentBits, Events, EmbedBuilder } = require('discord.js'); //discord.js からClientとIntentsを読み込む
const {token,guildId} = require('./config.json');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates
  ]
});  //clientインスタンスを作成する

const commands = {};

const commandsPath = path.join(__dirname,'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'))

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if('data' in command && 'execute' in command){
        commands[command.data.name] = command;
    }else{
        console.log(`[WARNING] The command at ${filePath} is missing a required \"data\" or \"execute\" property.`);
    }
}

client.once(Events.ClientReady, async () => {
    const data = []
    for (const commandName in commands) {
        data.push(commands[commandName].data)
    }
    if(guildId) {
        await client.application.commands.set(data, guildId);
    }
    else {
        await client.application.commands.set(data);
    }
    console.log("Ready!");
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isCommand()) {
        const command = commands[interaction.commandName];
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            await interaction.reply({
                content: 'There was an error while executing this command!',
                ephemeral: true,
            })
        }
    } else if (interaction.isButton()) {
        // ボタンのインタラクション処理
        await handleButtonInteraction(interaction);
    } else if (interaction.isStringSelectMenu()) {
        // セレクトメニューのインタラクション処理
        await handleSelectMenuInteraction(interaction);
    }
});
async function handleButtonInteraction(interaction) {
    // セッションが開始されているかチェック
    if (interaction.channel.status != 1) {
        await interaction.reply({ content: "チーム分けセッションが開始されていません", ephemeral: true });
        return;
    }

    const sessionData = interaction.channel.TEAM;
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    // 鬼立候補ボタン（参加者なら誰でも使用可能）
    if (interaction.customId === 'candidate_oni') {
        if (sessionData.mode !== 'tag') {
            await interaction.reply({ content: "このボタンは鬼ごっこモードでのみ使用できます", ephemeral: true });
            return;
        }

        const targetMember = interaction.guild.members.cache.get(interaction.user.id);
        
        // 参加者に含まれているかチェック
        const memberExists = sessionData.members.find(member => member.id === interaction.user.id);
        if (!memberExists) {
            await interaction.reply({ content: "参加者のみがこのボタンを使用できます", ephemeral: true });
            return;
        }

        // 鬼候補者リストが存在しない場合は初期化
        if (!sessionData.oniCandidates) {
            sessionData.oniCandidates = [];
        }

        // 既に鬼候補者に含まれているかチェック
        const alreadyCandidate = sessionData.oniCandidates.find(member => member.id === interaction.user.id);
        if (alreadyCandidate) {
            // 既に候補者の場合は削除
            const candidateIndex = sessionData.oniCandidates.findIndex(member => member.id === interaction.user.id);
            sessionData.oniCandidates.splice(candidateIndex, 1);
            
            // Embedを更新
            const embed = createEmbed(sessionData);
            const buttons = createButtons(sessionData);
            await sessionData.msg.edit({ embeds: [embed], components: buttons });
            
            await interaction.reply({ content: `${targetMember.toString()}を鬼候補者から削除しました！`, ephemeral: true });
        } else {
            // 候補者に追加
            sessionData.oniCandidates.push(targetMember);
            
            // Embedを更新
            const embed = createEmbed(sessionData);
            const buttons = createButtons(sessionData);
            await sessionData.msg.edit({ embeds: [embed], components: buttons });
            
            await interaction.reply({ content: `${targetMember.toString()}を鬼候補者に追加しました！`, ephemeral: true });
        }
        return;
    }

    // 以下は作成者限定ボタン
    if (interaction.user.id !== sessionData.creatorId) {
        await interaction.reply({ content: "このボタンはセッション作成者のみが使用できます", ephemeral: true });
        return;
    }

    // モード切り替えボタン
    if (interaction.customId === 'switch_to_equal' || interaction.customId === 'switch_to_tag') {
        const newMode = interaction.customId === 'switch_to_equal' ? 'equal' : 'tag';
        
        if (sessionData.mode === newMode) {
            await interaction.reply({ content: `既に${newMode === 'tag' ? '鬼ごっこ' : '均等分割'}モードです`, ephemeral: true });
            return;
        }

        // モードを変更
        sessionData.mode = newMode;
        
        // チーム構成をリセット
        if (newMode === 'tag') {
            const groupCount = Math.floor(sessionData.members.length / 5);
            sessionData.teams = new Array(groupCount).fill().map(() => ({ oni: null, runners: [] }));
            sessionData.groupCount = groupCount;
        } else if (newMode === 'equal') {
            const teamCount = Math.ceil(sessionData.members.length / sessionData.teamSize);
            sessionData.teams = new Array(teamCount).fill().map(() => []);
        }

        // Embedとボタンを更新
        const embed = createEmbed(sessionData);
        const buttons = createButtons(sessionData);
        await sessionData.msg.edit({ embeds: [embed], components: buttons });

        const modeText = newMode === 'tag' ? '鬼ごっこ' : '均等分割';
        await interaction.reply({ content: `モードを${modeText}に変更しました！`, ephemeral: true });
    }
    // 鬼候補クリアボタン
    else if (interaction.customId === 'clear_oni_candidates') {
        if (sessionData.mode !== 'tag') {
            await interaction.reply({ content: "このボタンは鬼ごっこモードでのみ使用できます", ephemeral: true });
            return;
        }

        const previousCount = sessionData.oniCandidates ? sessionData.oniCandidates.length : 0;
        sessionData.oniCandidates = [];

        // Embedとボタンを更新
        const embed = createEmbed(sessionData);
        const buttons = createButtons(sessionData);
        await sessionData.msg.edit({ embeds: [embed], components: buttons });

        await interaction.reply({ content: `鬼候補者リストをクリアしました！（${previousCount}人 → 0人）`, ephemeral: true });
    }
    // チーム人数変更ボタン
    else if (interaction.customId === 'change_team_size') {
        if (sessionData.mode !== 'equal') {
            await interaction.reply({ content: "このボタンは均等分割モードでのみ使用できます", ephemeral: true });
            return;
        }

        // 1-10の選択肢を作成
        const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
        
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_team_size')
            .setPlaceholder('チーム人数を選択してください');

        for (let i = 1; i <= 10; i++) {
            selectMenu.addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel(`${i}人`)
                    .setValue(i.toString())
                    .setDescription(`1チームあたり${i}人`)
                    .setDefault(i === sessionData.teamSize)
            );
        }

        const selectRow = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.reply({ 
            content: `現在のチーム人数: ${sessionData.teamSize}人\n新しいチーム人数を選択してください:`,
            components: [selectRow],
            ephemeral: true
        });
    }
    // シャッフルボタン
    else if (interaction.customId === 'shuffle_teams') {
        if (sessionData.members.length === 0) {
            await interaction.reply({ content: "参加者がいません", ephemeral: true });
            return;
        }

        if (sessionData.mode === 'tag') {
            // 鬼ごっこモード: randomoniと同じロジック
            if (sessionData.members.length < 5) {
                await interaction.reply({ content: "最低5人必要です（1グループあたり5人）", ephemeral: true });
                return;
            }

            if (!sessionData.oniCandidates) {
                sessionData.oniCandidates = [];
            }

            const requiredOniCount = sessionData.teams.length;
            const candidateCount = sessionData.oniCandidates.length;

            let selectedOnis = [];
            let remainingMembers = [...sessionData.members];

            if (candidateCount < requiredOniCount) {
                selectedOnis = [...sessionData.oniCandidates];
                remainingMembers = sessionData.members.filter(member => 
                    !sessionData.oniCandidates.some(candidate => candidate.id === member.id)
                );
                const shortage = requiredOniCount - candidateCount;
                for (let i = 0; i < shortage; i++) {
                    if (remainingMembers.length > 0) {
                        const randomIndex = Math.floor(Math.random() * remainingMembers.length);
                        selectedOnis.push(remainingMembers.splice(randomIndex, 1)[0]);
                    }
                }
            } else if (candidateCount === requiredOniCount) {
                selectedOnis = [...sessionData.oniCandidates];
                remainingMembers = sessionData.members.filter(member => 
                    !sessionData.oniCandidates.some(candidate => candidate.id === member.id)
                );
            } else {
                const shuffledCandidates = [...sessionData.oniCandidates];
                for (let i = shuffledCandidates.length - 1; i >= 0; i--) {
                    const rand = Math.floor(Math.random() * (i + 1));
                    [shuffledCandidates[i], shuffledCandidates[rand]] = [shuffledCandidates[rand], shuffledCandidates[i]];
                }
                selectedOnis = shuffledCandidates.slice(0, requiredOniCount);
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
                sessionData.teams[i].oni = selectedOnis[i];
                sessionData.teams[i].runners = [];
                for (let j = 0; j < 4 && runnerIndex < remainingMembers.length; j++) {
                    sessionData.teams[i].runners.push(remainingMembers[runnerIndex]);
                    runnerIndex++;
                }
            }

            let resultMessage = `🎲 ${sessionData.teams.length}グループに鬼を配置しました！`;
            await interaction.reply({ content: resultMessage, ephemeral: true });

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

            await interaction.reply({ content: `🎲 シャッフル完了！${sessionData.teams.length}チームにランダム分割しました！`, ephemeral: true });
        }

        // Embedとボタンを更新
        const embed = createEmbed(sessionData);
        const buttons = createButtons(sessionData);
        await sessionData.msg.edit({ embeds: [embed], components: buttons });
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

// teamstart.jsから関数をコピー
function createEmbed(sessionData) {
    const { EmbedBuilder } = require('discord.js');
    let embed = new EmbedBuilder().setColor(0x0099FF);

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
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const buttons = [];
    
    const publicRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('candidate_oni')
                .setLabel('🙋‍♂️ 鬼立候補')
                .setStyle(ButtonStyle.Primary)
        );
    buttons.push(publicRow);

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

async function handleSelectMenuInteraction(interaction) {
    // セッションが開始されているかチェック
    if (interaction.channel.status != 1) {
        await interaction.reply({ content: "チーム分けセッションが開始されていません", ephemeral: true });
        return;
    }

    const sessionData = interaction.channel.TEAM;

    // チーム人数選択処理
    if (interaction.customId === 'select_team_size') {
        // 作成者のみがチーム人数を変更可能
        if (interaction.user.id !== sessionData.creatorId) {
            await interaction.reply({ content: "このメニューはセッション作成者のみが使用できます", ephemeral: true });
            return;
        }

        if (sessionData.mode !== 'equal') {
            await interaction.reply({ content: "このメニューは均等分割モードでのみ使用できます", ephemeral: true });
            return;
        }

        const newSize = parseInt(interaction.values[0]);
        
        // チームサイズを更新
        sessionData.teamSize = newSize;
        
        // 新しいサイズに基づいてチーム配列を再構築
        const teamCount = Math.ceil(sessionData.members.length / newSize);
        sessionData.teams = new Array(teamCount).fill().map(() => []);

        // Embedとボタンを更新
        const embed = createEmbed(sessionData);
        const buttons = createButtons(sessionData);
        await sessionData.msg.edit({ embeds: [embed], components: buttons });

        await interaction.update({ 
            content: `✅ チーム人数を${newSize}人に変更しました！\n必要チーム数: ${teamCount}チーム`,
            components: []
        });
    }
}

client.login(token);
