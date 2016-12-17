function midPointBtw(p1, p2) {
  return {
    x: p1.x + (p2.x - p1.x) / 2,
    y: p1.y + (p2.y - p1.y) / 2
  };
}

function getPattern() {
  return ctx.createPattern(img, 'repeat');
}

var el = document.getElementById('c');
var ctx = el.getContext('2d');
var rect;


ctx.lineWidth = 8;
ctx.lineJoin = ctx.lineCap = 'round';

var img = new Image();
img.onload = function() {
  ctx.strokeStyle = getPattern();
};
img.src = 'https://s18.postimg.org/qb3f0jjex/black.png';

var isDrawing, points = [ ];

el.onmousedown = function(e) {
  rect = el.getBoundingClientRect();
  isDrawing = true;
  points.push({ x: e.clientX - rect.left, y: e.clientY - rect.top });
};

el.onmousemove = function(e) {
  if (!isDrawing) return;
  
  points.push({ x: e.clientX - rect.left, y: e.clientY - rect.top });

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  
  var p1 = points[0];
  var p2 = points[1];
  
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);

  for (var i = 1, len = points.length; i < len; i++) {
    var midPoint = midPointBtw(p1, p2);
    ctx.quadraticCurveTo(p1.x, p1.y, midPoint.x, midPoint.y);
    p1 = points[i];
    p2 = points[i+1];
  }
  ctx.lineTo(p1.x, p1.y);
  ctx.stroke();
};

el.onmouseup = function() {
  isDrawing = false;
  points.length = 0;
};