const express = require("express");

const app = express();
app.use(express.json());

const PORT = 3000;

// -------------------------
// DATA
// -------------------------

const users = [];
const groups = [];
const expenses = [];

let userId = 1;
let groupId = 1;
let expenseId = 1;

const rates = {
    INR: 1,
    USD: 95.16,
    EUR: 108.33
};


// -------------------------
// HELPER FUNCTIONS
// -------------------------

function findUser(id) {
    return users.find(user => user.id === id);
}

function findGroup(id) {
    return groups.find(group => group.id === id);
}

function findExpense(id, groupId) {
    return expenses.find(
        expense => expense.id === id && expense.groupId === groupId
    );
}

function convert(amount, from, to) {
    if (from === to) {
        return Number(amount.toFixed(2));
    }

    const inINR = amount * rates[from];

    return Number((inINR / rates[to]).toFixed(2));
}


// -------------------------
// 1. CREATE USER
// POST /user
// -------------------------

app.post("/user", (req, res) => {

    const { username, email } = req.body;

    if (!username || !email) {
        return res.status(400).json({
            success: false,
            message: "username and email are required"
        });
    }

    const exists = users.find(user => user.email === email);

    if (exists) {
        return res.status(409).json({
            success: false,
            message: "A user with this email already exists"
        });
    }

    const user = {
        id: userId++,
        username,
        email
    };

    users.push(user);

    res.status(201).json({
        success: true,
        message: "User created successfully",
        data: {
            user_id: user.id
        }
    });
});


// -------------------------
// 2. CREATE GROUP
// POST /group
// -------------------------

app.post("/group", (req, res) => {

    const {
        group_name,
        owner_id,
        members,
        base_currency
    } = req.body;

    if (
        !group_name ||
        !owner_id ||
        !members ||
        !base_currency
    ) {
        return res.status(400).json({
            success: false,
            message: "Please add all required field"
        });
    }

    if (!rates[base_currency]) {
        return res.status(400).json({
            success: false,
            message: "Unsupported currency"
        });
    }

    // Check owner
    if (!findUser(owner_id)) {
        return res.status(404).json({
            success: false,
            message: `No user found with id ${owner_id}`
        });
    }

    // Check every member
    for (const id of members) {

        if (!findUser(id)) {
            return res.status(404).json({
                success: false,
                message: `No user found with id ${id}`
            });
        }
    }

    const group = {
        id: groupId++,
        group_name,
        owner_id,
        members,
        base_currency
    };

    groups.push(group);

    res.status(201).json({
        success: true,
        message: "Group created successfully",
        data: {
            group_id: group.id
        }
    });
});


// -------------------------
// 3. CREATE EXPENSE
// POST /group/:groupId/expense
// -------------------------

app.post("/group/:groupId/expense", (req, res) => {

    const groupId = Number(req.params.groupId);

    const group = findGroup(groupId);

    if (!group) {
        return res.status(404).json({
            success: false,
            message: `No group found with id ${groupId}`
        });
    }

    const {
        paid_by,
        involved_members,
        amount,
        expense_currency,
        description,
        splits
    } = req.body;


    // Basic validation

    if (
        paid_by === undefined ||
        !involved_members ||
        amount === undefined ||
        !expense_currency
    ) {
        return res.status(400).json({
            success: false,
            message: "Please add all required fields"
        });
    }


    if (amount <= 0) {
        return res.status(400).json({
            success: false,
            message: "amount must be greater than 0"
        });
    }


    if (!rates[expense_currency]) {
        return res.status(400).json({
            success: false,
            message: "Unsupported currency"
        });
    }


    // Check payer

    if (!group.members.includes(paid_by)) {
        return res.status(403).json({
            success: false,
            message: "paid_by must be a member of this group"
        });
    }


    // Check involved members

    for (const id of involved_members) {

        if (!group.members.includes(id)) {
            return res.status(403).json({
                success: false,
                message: `User ${id} must be a member of this group`
            });
        }
    }


    // Convert expense to group currency

    const convertedAmount = convert(
        Number(amount),
        expense_currency,
        group.base_currency
    );


    // -------------------------
    // CUSTOM SPLIT
    // -------------------------

    let finalSplits = null;

    if (splits) {

        let total = 0;

        for (const split of splits) {

            if (!involved_members.includes(split.user_id)) {
                return res.status(400).json({
                    error: "VALIDATION_ERROR",
                    message:
                        "Every split user_id must be in involved_members"
                });
            }

            total += Number(split.amount);
        }

        total = Number(total.toFixed(2));

        if (total !== convertedAmount) {
            return res.status(400).json({
                error: "SPLIT_MISMATCH",
                message: "Sum of splits must equal to the amount"
            });
        }

        finalSplits = splits;
    }


    // Create expense

    const expense = {
        id: expenseId++,
        groupId,
        paid_by,
        involved_members,
        amount: convertedAmount,
        splits: finalSplits,
        description
    };

    expenses.push(expense);

    res.status(201).json({
        success: true,
        message: "Expense created successfully",
        data: {
            expense_id: expense.id
        }
    });
});


// -------------------------
// 4. UPDATE EXPENSE
// PUT /group/:groupId/expense/:expenseId
// -------------------------

app.put(
    "/group/:groupId/expense/:expenseId",
    (req, res) => {

        const groupId = Number(req.params.groupId);
        const expenseId = Number(req.params.expenseId);

        const group = findGroup(groupId);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: `No group found with id ${groupId}`
            });
        }

        const expense = findExpense(
            expenseId,
            groupId
        );

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: `No expanse found with id ${expenseId}`
            });
        }

        const {
            paid_by,
            involved_members,
            amount,
            expense_currency,
            description
        } = req.body;


        if (!group.members.includes(paid_by)) {
            return res.status(403).json({
                success: false,
                message: "paid_by must be a member of this group"
            });
        }


        for (const id of involved_members) {

            if (!group.members.includes(id)) {
                return res.status(403).json({
                    success: false,
                    message: `User ${id} must be a member of this group`
                });
            }
        }


        const convertedAmount = convert(
            Number(amount),
            expense_currency,
            group.base_currency
        );


        expense.paid_by = paid_by;
        expense.involved_members = involved_members;
        expense.amount = convertedAmount;
        expense.description = description;


        res.status(200).json({
            success: true,
            message: "Expanse updated successfully"
        });
    }
);


// -------------------------
// 5. GET SIMPLIFIED OWES
// GET /group/:groupId/owes
// -------------------------

app.get("/group/:groupId/owes", (req, res) => {

    const groupId = Number(req.params.groupId);

    const group = findGroup(groupId);

    if (!group) {
        return res.status(404).json({
            success: false,
            message: `No group found with id ${groupId}`
        });
    }


    // -------------------------
    // STEP 1: Calculate balances
    // -------------------------

    const balances = {};

    for (const member of group.members) {
        balances[member] = 0;
    }


    for (const expense of expenses) {

        if (expense.groupId !== groupId) {
            continue;
        }


        // Payer gets money back

        balances[expense.paid_by] += expense.amount;


        // Custom split

        if (expense.splits) {

            for (const split of expense.splits) {

                balances[split.user_id] -=
                    Number(split.amount);
            }

        }

        // Equal split

        else {

            const share =
                expense.amount /
                expense.involved_members.length;


            for (const member of expense.involved_members) {

                balances[member] -= share;
            }
        }
    }


    // -------------------------
    // STEP 2:
    // Separate debtors/creditors
    // -------------------------

    const debtors = [];
    const creditors = [];


    for (const [id, balance] of Object.entries(balances)) {

        const amount =
            Number(Math.abs(balance).toFixed(2));


        if (amount < 0.01) {
            continue;
        }


        if (balance < 0) {

            debtors.push({
                id: Number(id),
                amount
            });

        } else {

            creditors.push({
                id: Number(id),
                amount
            });
        }
    }


    // -------------------------
    // STEP 3:
    // Simplify
    // -------------------------

    const result = [];

    let i = 0;
    let j = 0;


    while (
        i < debtors.length &&
        j < creditors.length
    ) {

        const debtor = debtors[i];
        const creditor = creditors[j];


        const amount = Number(
            Math.min(
                debtor.amount,
                creditor.amount
            ).toFixed(2)
        );


        result.push({
            from: debtor.id,
            to: creditor.id,
            amount,
            currency: group.base_currency
        });


        debtor.amount =
            Number(
                (debtor.amount - amount)
                .toFixed(2)
            );


        creditor.amount =
            Number(
                (creditor.amount - amount)
                .toFixed(2)
            );


        if (debtor.amount < 0.01) {
            i++;
        }


        if (creditor.amount < 0.01) {
            j++;
        }
    }


    res.status(200).json({
        success: true,
        data: {
            group_id: group.id,
            group_currency: group.base_currency,
            simplified_owes: result
        }
    });
});


// -------------------------
// START SERVER
// -------------------------

app.listen(PORT, () => {
    console.log(
        `Server running at http://localhost:${PORT}`
    );
});