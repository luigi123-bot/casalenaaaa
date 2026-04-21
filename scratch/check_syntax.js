const fs = require('fs');
const content = fs.readFileSync('c:/Users/gotop:OneDrive/Desktop/casalenaaaa/components/OrderDetailsPanel.tsx', 'utf8');

const checkBalance = (open, close, name) => {
    let count = 0;
    const lines = content.split('\n');
    lines.forEach((line, i) => {
        const lineOpens = (line.match(new RegExp(open, 'g')) || []).length;
        const lineCloses = (line.match(new RegExp(close, 'g')) || []).length;
        count += lineOpens;
        count -= lineCloses;
        if (count < 0) {
            console.log(`Mismatch (${name} < 0) at line ${i+1}: ${line}`);
            count = 0;
        }
    });
    console.log(`Final ${name} count: ${count}`);
};

checkBalance('{', '}', 'Braces');
checkBalance('\\(', '\\)', 'Parens');
checkBalance('<div', '</div>', 'Divs');
