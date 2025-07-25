const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('コマンド一覧'),
    async execute(interaction) {
        let embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🎮 チーム分けBOT コマンド一覧')
            .setDescription('鬼ごっこ・均等分割対応のチーム分けBOTです')
            .addFields(
                {
                    name: '📋 基本コマンド',
                    value: '`/teamstart [mode]` - セッション開始\n' +
                           '`/mode <type>` - モード切り替え\n' +
                           '`/teamend` - セッション終了\n' +
                           '`/refresh` - VCメンバー再取得'
                },
                {
                    name: '👹 鬼ごっこモード（1vs4複数グループ）',
                    value: '`/addoni <user>` - 鬼候補者に追加\n' +
                           '`/removeoni <user>` - 鬼候補者から削除\n' +
                           '`/clearoni` - 鬼候補者リストをクリア\n' +
                           '`/randomoni` - 鬼候補者を考慮して鬼を配置'
                },
                {
                    name: '⚖️ 均等分割モード',
                    value: '`/setsize <size>` - チーム人数設定'
                },
                {
                    name: '🎲 共通機能',
                    value: '`/shuffle` - ランダム再分割\n' +
                           '`/pick [team]` - ランダム抽選'
                },
                {
                    name: '🎯 ユーティリティ',
                    value: '`/dice` - サイコロ\n' +
                           '`/ccb` - クトゥルフ神話TRPG用ダイス'
                },
                {
                    name: '📝 フィルタリング機能',
                    value: '• VCに参加している人のみ対象\n' +
                           '• 名前が「観戦」で始まる人を除外\n' +
                           '• BOTユーザーを除外'
                }
            )
            .setFooter({ text: 'Created by: altivelis' });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}
