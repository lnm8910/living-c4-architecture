const amqp = require('amqplib');
const nodemailer = require('nodemailer');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
const SMTP_HOST = process.env.SMTP_HOST || 'localhost';
const SMTP_PORT = process.env.SMTP_PORT || 1025;

// Email transporter (uses MailHog in dev)
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: false,
});

async function start() {
  try {
    // Connect to RabbitMQ
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();

    const queue = 'order_notifications';
    await channel.assertQueue(queue, { durable: true });

    console.log('Notification Service waiting for messages...');

    // Consume messages
    channel.consume(queue, async (msg) => {
      if (msg) {
        const order = JSON.parse(msg.content.toString());
        console.log('Received order notification:', order.id);

        // Send email
        await transporter.sendMail({
          from: 'orders@example.com',
          to: order.userEmail,
          subject: `Order ${order.id} Confirmation`,
          text: `Your order has been received. Order ID: ${order.id}`,
        });

        channel.ack(msg);
      }
    });
  } catch (error) {
    console.error('Failed to start notification service:', error);
    process.exit(1);
  }
}

start();
