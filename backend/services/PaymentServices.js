     
const { NotFoundError, ValidationError, BadRequestError } = require('../utils/errors')
const Nyxcipher = require("../models/Nyxcipher")
const User = require("../models/User")
const Payment = require("../models/Payment")
const Ticket = require("../models/Ticket")
const Cart = require("../models/Cart")

exports.getPaymentsHistory = async (email) => {
    const user = await User.findOne({ email: email })
    if (!user) throw new NotFoundError('Account not found')

    let payment_histories = await Payment.find({ buyer_id: user._id })
        .populate({
            path: 'nyxcipher_id',
            model: 'Nyxcipher',
            populate: {
                path: 'nyxcipher_item_id',
                model: 'Item'
            }
        })
        .populate('buyer_id')
        .populate('ticket_id')
        .sort({ purchase_date: -1 })
        .exec()
    if (!payment_histories) throw new NotFoundError('Payment not found')

    return payment_histories
}

exports.getOnePaidPayment = async (email, id) => {
    const user = await User.findOne({ email: email })
    if (!user) throw new NotFoundError('Account not found')

    const payment = await Payment.findById(id)
    if (!payment) throw new NotFoundError('Payment not found')

    return payment
}

const generateNumbers = (length) => {
    let numbers = []
    for (let i = 0
        ; i < length
        ; i++) {
        const rnumb = Math.floor(Math.random() * (9999999 - 1000000) + 1000000)
            ;
        numbers.push(rnumb)
    }
    return numbers
}

exports.savePayment = async (email, body) => {
    const user = await User.findOne({ email: email })
        .populate({
            path: "cart_entry",
            populate: [{
                path: "nyxcipher_id",
                model: "Nyxcipher",
                populate: {
                    path: "nyxcipher_item_id",
                    model: "Item",
                }
            }, {
                path: "ticket_id",
                model: "Ticket",
            }]
        }).exec()
    if (!user) throw new NotFoundError('Account not found')
    if (!user.cart_entry || user.cart_entry.length <= 0) throw new ValidationError('Cart is empty')

    let payments = []
    for (let i = 0
        ; i < user.cart_entry.length
        ; i++) {
        const payment = new Payment({
            buyer_id: user._id,
            nyxcipher_id: user.cart_entry[i].nyxcipher_id, // nyxciphers joined with phurchased tickets
            ticket_id: user.cart_entry[i].ticket_id, // phurchased tickets
            purchase_date: new Date(),
            assigned_numbers: generateNumbers(user.cart_entry[i].ticket_id.ticket_count),
            amount_paid: user.cart_entry[i].ticket_id.ticket_price,
            payment_processor: body.payment_processor
        })
        await Cart.deleteOne({ _id: user.cart_entry[i]._id })
        const saved_payment = await payment.save()
        payments.push(saved_payment)
        let ticket = await Ticket.findOne({ _id: user.cart_entry[i].ticket_id })
        ticket.payment_id = saved_payment._id
        await ticket.save()
    }
    user.cart_entry = []
    await user.save()

    return payments
}

exports.updatePayment = async (id, body) => {
    const { nyxcipher_name, nyxcipher_category, nyxcipher_item_id, charity_recipient } = body
    let nyxcipher = await Ticket.findById(id)

    if (!nyxcipher) throw new NotFoundError('Ticket not found')
    let update_nyxcipher = {
        ...nyxcipher._doc,
        nyxcipher_name: nyxcipher_name ? nyxcipher_name : nyxcipher._doc.nyxcipher_name,
        nyxcipher_category: nyxcipher_category ? nyxcipher_category : nyxcipher._doc.nyxcipher_category,
        nyxcipher_item_id: nyxcipher_item_id ? nyxcipher_item_id : nyxcipher._doc.nyxcipher_item_id,
        charity_recipient: charity_recipient ? charity_recipient : nyxcipher._doc.charity_recipient,
    }

    console.log(update_nyxcipher)
    await nyxcipher.updateOne(update_nyxcipher)

    return update_nyxcipher
}

exports.deletePayment = async (id) => {
    let nyxcipher = await Ticket.findById(id)
    if (!nyxcipher) throw new NotFoundError('Ticket not found')
    await nyxcipher.deleteOne()
    return true
}
